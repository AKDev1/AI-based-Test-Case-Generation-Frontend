import { render, screen } from '@testing-library/react';
import App from './App';

test('renders configuration message when Google client ID is missing', () => {
  render(<App />);
  expect(screen.getByText(/AI Testcase Generator/i)).toBeInTheDocument();
  expect(screen.getByText(/REACT_APP_GOOGLE_CLIENT_ID/i)).toBeInTheDocument();
});
