import { Tooltip } from 'radix-ui';

export default function HelpTip({ label, children }) {
  return <Tooltip.Provider delayDuration={350}>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className="help-tip-trigger" aria-label={`Explain ${label}`}>?</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="help-tip-content" side="top" sideOffset={8} collisionPadding={12}>
          {children}
          <Tooltip.Arrow className="help-tip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>;
}
