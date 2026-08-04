'use client';

import { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'disabled';
  description?: string;
}

interface MobileActionMenuProps {
  actions: ActionItem[];
  triggerLabel?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  showOnDesktop?: boolean;
}

export function MobileActionMenu({
  actions,
  triggerLabel,
  align = 'end',
  className,
  showOnDesktop = false,
}: MobileActionMenuProps) {
  const visibleActions = actions.filter((a) => a.variant !== 'disabled');

  return (
    <div className={cn(showOnDesktop ? 'flex' : 'flex lg:hidden', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={triggerLabel ? 'default' : 'icon'}
            className="min-h-[44px] min-w-[44px]"
          >
            {triggerLabel ? (
              <>
                <span className="mr-2">{triggerLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </>
            ) : (
              <MoreVertical className="w-5 h-5" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          className="w-56 bg-[var(--surface-1)] border border-[var(--surface-3)] shadow-xl rounded-xl p-1 backdrop-blur-0"
        >
          {visibleActions.map((action, index) => (
            <DropdownMenuItem
              key={index}
              onClick={action.onClick}
              disabled={action.variant === 'disabled'}
              className={cn(
                'min-h-[44px] cursor-pointer focus:bg-gray-50',
                action.variant === 'danger' && 'text-red-600 focus:text-red-600 focus:bg-red-50'
              )}
            >
              {action.icon && (
                <span className="mr-2 flex items-center">{action.icon}</span>
              )}
              <div className="flex flex-col">
                <span>{action.label}</span>
                {action.description && (
                  <span className="text-xs text-gray-500">{action.description}</span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface DesktopActionBarProps {
  actions: ActionItem[];
  className?: string;
}

export function DesktopActionBar({ actions, className }: DesktopActionBarProps) {
  const visibleActions = actions.filter((a) => a.variant !== 'disabled');

  return (
    <div className={cn('hidden lg:flex items-center gap-2', className)}>
      {visibleActions.map((action, index) => (
        <Button
          key={index}
          onClick={action.onClick}
          variant={action.variant === 'danger' ? 'destructive' : 'outline'}
          disabled={action.variant === 'disabled'}
          className="min-h-[44px]"
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

interface ResponsiveActionGroupProps {
  actions: ActionItem[];
  mobileTriggerLabel?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function ResponsiveActionGroup({
  actions,
  mobileTriggerLabel,
  align = 'end',
  className,
}: ResponsiveActionGroupProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DesktopActionBar actions={actions} />
      <MobileActionMenu
        actions={actions}
        triggerLabel={mobileTriggerLabel}
        align={align}
      />
    </div>
  );
}
