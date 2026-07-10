export const SKINS = {
  Ledger: {
    name: 'Ledger',
    background: '#F9F9F9',
    contrast: '#000000',
    accent: '#FFD700',
    muted: '#666666',
  },
  Terminal: {
    name: 'Terminal',
    background: '#0A0E14',
    contrast: '#39FF14',
    accent: '#FFB000',
    muted: '#1B660A',
  },
  Classified: {
    name: 'Classified',
    background: '#EED9B3',
    contrast: '#3C2F2F',
    accent: '#C21E56',
    muted: '#7A6666',
  },
  Blueprint: {
    name: 'Blueprint',
    background: '#0033AA',
    contrast: '#FFFFFF',
    accent: '#00FFFF',
    muted: '#88AAFF',
  },
};

// Styling helpers for neobrutalist designs
export const neobrutalist = {
  // Borders
  border2: (contrastColor = '#000000') => ({
    borderWidth: 2,
    borderColor: contrastColor,
  }),
  border4: (contrastColor = '#000000') => ({
    borderWidth: 4,
    borderColor: contrastColor,
  }),

  // Hard drop shadow helper for iOS
  shadow: (contrastColor = '#000000', offset = 4) => ({
    shadowColor: contrastColor,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
  }),

  // Absolute positioning styling for cross-platform perfect hard drop shadow backdrop
  shadowBg: (contrastColor = '#000000', offset = 4) => ({
    position: 'absolute',
    top: offset,
    left: offset,
    right: -offset,
    bottom: -offset,
    backgroundColor: contrastColor,
    zIndex: -1,
  }),

  // Pressed button layout adjustment (simulating a physical press by offsetting and reducing shadow translation)
  pressed: (offset = 2) => ({
    transform: [{ translateY: offset }, { translateX: offset }],
  }),
};
