import clsx from 'clsx';
import React, { useState } from 'react';
import { PositionDir } from '@/utils/sel';

const tooltipPositionClasses: Record<PositionDir, string> = {
  up: 'lg:tooltip-top',
  down: 'lg:tooltip-bottom',
  left: 'lg:tooltip-left',
  right: 'lg:tooltip-right',
};

interface AnnotationToolButtonProps {
  showTooltip: boolean;
  tooltipText: string;
  tooltipPosition: PositionDir;
  disabled?: boolean;
  Icon: React.ElementType;
  onClick: () => void;
}

const AnnotationToolButton: React.FC<AnnotationToolButtonProps> = ({
  showTooltip,
  tooltipText,
  tooltipPosition,
  disabled,
  Icon,
  onClick,
}) => {
  const [buttonClicked, setButtonClicked] = useState(false);
  const handleClick = () => {
    setButtonClicked(true);
    onClick();
  };
  return (
    <div
      className={clsx('lg:tooltip', tooltipPositionClasses[tooltipPosition])}
      data-tip={!buttonClicked && showTooltip ? tooltipText : undefined}
    >
      <button
        onClick={handleClick}
        aria-label={tooltipText}
        className={clsx(
          'flex h-8 min-h-8 w-8 items-center justify-center p-0',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'not-eink:hover:bg-gray-500 eink:hover:border rounded-md',
        )}
        disabled={disabled}
      >
        <Icon />
      </button>
    </div>
  );
};

export default AnnotationToolButton;
