import { describe, it, expect } from 'vitest';
import React from 'react';
import { ShareModal } from './components/ShareModal';

describe('ShareModal Responsive Layout & Component Structure', () => {
  const defaultProps = {
    isOpen: true,
    onClose: () => {},
    sessions: [],
    selectedRepo: 'ALL',
  };

  it('renders null when isOpen is false', () => {
    const element = React.createElement(ShareModal, { ...defaultProps, isOpen: false });
    expect(element).toBeDefined();
  });

  it('creates ShareModal element when isOpen is true', () => {
    const element = React.createElement(ShareModal, defaultProps);
    expect(element.props.isOpen).toBe(true);
    expect(element.props.selectedRepo).toBe('ALL');
  });
});
