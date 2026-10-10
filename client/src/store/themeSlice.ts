import { createSlice } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark';

function getInitialTheme(): ThemeMode {
  try {
    return localStorage.getItem('milltrace-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: getInitialTheme() },
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
    },
  },
});

export const { toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
