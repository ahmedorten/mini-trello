export interface ThemeClass {
  bg: string;
  text: string;
  border: string;
}

export class LabelTheme {
  public static getTheme(hexColor: string): ThemeClass {
    // Basic contrast metric: light background vs dark text
    const color = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const text = luminance > 0.6 ? 'text-gray-800' : 'text-white';
    
    return {
      bg: `background-color: ${color}`,
      text,
      border: `border-color: ${color}`,
    };
  }
}

export default LabelTheme;
