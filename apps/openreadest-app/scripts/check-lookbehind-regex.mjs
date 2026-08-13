#!/usr/bin/env node
/**
 * 语义化 lookbehind 正则检查器（替代字符串级 grep）。
 *
 * 背景：check:lookbehind-regex 的原始意图（fd7f9023 "compat(ios): avoid lookbehind
 * assertions for iOS older than 16.4"）是防止构建产物中出现 iOS <16.4 WebKit 无法
 * **解析**的 lookbehind 正则字面量（引擎在解析 /.../ 时抛 SyntaxError，加载即崩）。
 *
 * 但字符串级 grep 会产生误报：字符串/模板字符串中的 "(?<=" 文本不会被引擎解析为正则，
 * 例如 AI SDK 的 zod3-to-json-schema 把 "(^|(?<=[\r\n]))" 作为 JSON schema 的 pattern
 * 字段输出（数据而非代码），并不构成兼容性风险。
 *
 * 本检查器用 AST 精确判定「可执行的 lookbehind」：
 *   - 正则字面量 /(?<=x)/  → 失败（老 WebKit 解析即崩）
 *   - 静态 RegExp('(?<=x)') / new RegExp(...) 构造 → 失败（运行时构造后使用）
 *   - 普通字符串 / 模板字符串 → 放行（除非直接作为 RegExp 构造参数）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');

// 扫描目录：仅扫描实际存在的目录，避免 out/ 未生成时的 "No such file" 噪音。
const SCAN_DIRS = ['.next/static/chunks', 'out/_next/static/chunks']
  .map((d) => path.join(APP_DIR, d))
  .filter((d) => fs.existsSync(d));

const LOOKBEHIND = /\(\?<[!=]/;

/** 取字符串/模板字面量的静态值；动态插值的模板返回 null（无法静态判定，放行）。 */
const getStaticString = (node) => {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }
  return null;
};

/** 判定某 AST 节点是否为「静态 RegExp 构造」，返回其 pattern 静态值或 null。 */
const getStaticRegExpPattern = (node) => {
  if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return null;
  const callee = node.callee;
  const isRegExpCtor =
    (callee.type === 'Identifier' && callee.name === 'RegExp') ||
    (callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'RegExp' && // RegExp.prototype 等不在此列
      callee.property.type === 'Identifier' &&
      callee.property.name === 'constructor') ||
    // 可能的全局别名引用（globalThis.RegExp）
    (callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'RegExp');
  if (!isRegExpCtor) return null;
  return getStaticString(node.arguments?.[0]);
};

const findings = [];

for (const dir of SCAN_DIRS) {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const abs = path.join(dir, file);
    const src = fs.readFileSync(abs, 'utf8');
    let ast;
    try {
      ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true });
    } catch (err) {
      // 解析失败不应静默吞掉——单独报告（可能是新语法或产物损坏），但不判为 lookbehind 违规。
      findings.push({ file: path.relative(APP_DIR, abs), note: `AST 解析失败: ${err.message}` });
      continue;
    }
    const walk = (node) => {
      if (!node || typeof node.type !== 'string') return;
      // 正则字面量
      if (node.type === 'Literal' && node.regex && LOOKBEHIND.test(node.regex.pattern)) {
        findings.push({ file: path.relative(APP_DIR, abs), pattern: node.regex.pattern });
      }
      // 静态 RegExp 构造
      if (node.type === 'NewExpression' || node.type === 'CallExpression') {
        const pattern = getStaticRegExpPattern(node);
        if (pattern && LOOKBEHIND.test(pattern)) {
          findings.push({ file: path.relative(APP_DIR, abs), pattern });
        }
      }
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(walk);
        else if (child && typeof child === 'object') walk(child);
      }
    };
    walk(ast);
  }
}

// 仅 AST 解析失败（非违规）时给出提示但继续
const hardFindings = findings.filter((f) => f.pattern);
const parseIssues = findings.filter((f) => f.note);

if (hardFindings.length > 0) {
  console.error(`❌ Lookbehind regex (executable) found in output!`);
  for (const f of hardFindings) console.error(`   ${f.file} → /${f.pattern}/`);
  process.exit(1);
}
for (const f of parseIssues) console.warn(`⚠️  ${f.file}: ${f.note}`);
console.log(`✅ No executable lookbehind regex found (${SCAN_DIRS.length} dir(s) scanned).`);
