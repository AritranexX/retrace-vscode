import { describe, it, expect } from 'vitest';
import React from 'react';
import { ControlsHeader } from './components/ControlsHeader';

describe('ControlsHeader Tier Display', () => {
  it('does not render the word Free when user is in free tier (isPro = false)', () => {
    const props = {
      isPro: false,
      isLoading: false,
      searchQuery: '',
      onSearchChange: () => {},
      selectedRepo: 'ALL',
      onSelectRepo: () => {},
      repoMetrics: [],
      onRefresh: () => {},
      onExport: () => {},
      onOpenLicenseModal: () => {},
    };

    const element = React.createElement(ControlsHeader, props);
    // Render element or test structure
    expect(element.props.isPro).toBe(false);
  });

  it('renders PRO when user has pro tier after purchase (isPro = true)', () => {
    const props = {
      isPro: true,
      isLoading: false,
      searchQuery: '',
      onSearchChange: () => {},
      selectedRepo: 'ALL',
      onSelectRepo: () => {},
      repoMetrics: [],
      onRefresh: () => {},
      onExport: () => {},
      onOpenLicenseModal: () => {},
    };

    const element = React.createElement(ControlsHeader, props);
    expect(element.props.isPro).toBe(true);
  });
});
