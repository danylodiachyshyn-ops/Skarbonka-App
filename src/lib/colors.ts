/**
 * Brand Colors for Skarbonka App
 * Based on the official brand guidelines
 */

export const BrandColors = {
  // Primary brand colors
  lightBlue: '#33A8E8', // Upper part of circle (lighter)
  deepBlue: '#1F96D3', // Lower part of circle (main brand color)
  white: '#FFFFFF', // Paper airplane symbol
  darkGray: '#4A4E52', // Background around icon

  // Gradient for logo
  gradient: {
    start: '#33A8E8',
    end: '#1F96D3',
  },
} as const;

// Default color for new piggy banks
export const DEFAULT_PIGGY_BANK_COLOR = BrandColors.deepBlue;
