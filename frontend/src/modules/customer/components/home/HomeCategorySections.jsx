import React from 'react';
import HomeCategoryGrid from './HomeCategoryGrid';

/**
 * Renders storefront category sections (parent category name + image tiles).
 */
const HomeCategorySections = ({ sections = [], className = '' }) => {
  if (!sections.length) return null;

  return (
    <div className={className}>
      {sections.map((section) => (
        <HomeCategoryGrid
          key={section.id}
          title={section.title}
          categories={section.items}
        />
      ))}
    </div>
  );
};

export default HomeCategorySections;
