import React from 'react';
import { cn } from '@/lib/utils';

const DataTable = ({ columns, data, onRowClick, className, emptyMessage = 'No data available' }) => {
    if (!data?.length) {
        return (
            <div className={cn("rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center", className)}>
                <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={cn("overflow-x-auto overscroll-x-contain -mx-1 px-1", className)}>
            <table className="ds-table min-w-full">
                <thead className="ds-table-header sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                    <tr>
                        {columns.map((column, index) => (
                            <th 
                                key={index} 
                                className={cn(
                                    "ds-table-header-cell whitespace-nowrap",
                                    column.align === 'right' && 'text-right',
                                    column.align === 'center' && 'text-center'
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr 
                            key={rowIndex} 
                            className={cn(
                                "ds-table-row",
                                onRowClick && "cursor-pointer"
                            )}
                            onClick={() => onRowClick && onRowClick(row)}
                            onKeyDown={onRowClick ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onRowClick(row);
                                }
                            } : undefined}
                            tabIndex={onRowClick ? 0 : undefined}
                            role={onRowClick ? 'button' : undefined}
                        >
                            {columns.map((column, colIndex) => (
                                <td 
                                    key={colIndex} 
                                    className={cn(
                                        "ds-table-cell",
                                        column.align === 'right' && 'text-right',
                                        column.align === 'center' && 'text-center'
                                    )}
                                >
                                    {column.cell ? column.cell(row) : row[column.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
