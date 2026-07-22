import React from 'react';
import { cn } from '@/lib/utils';

const PageHeader = ({ title, description, actions, badge, className }) => {
    return (
        <div className={cn("ds-page-header", className)}>
            <div className="ds-page-title-group min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h1 className="ds-h1 break-words">{title}</h1>
                    {badge && badge}
                </div>
                {description && <p className="ds-description">{description}</p>}
            </div>
            {actions && <div className="ds-page-actions w-full md:w-auto">{actions}</div>}
        </div>
    );
};

export default PageHeader;
