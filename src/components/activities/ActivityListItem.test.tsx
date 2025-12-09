import { render, screen } from '@testing-library/react';
import { ActivityListItem } from './ActivityListItem';
import '@testing-library/jest-dom';
import type { Tables, Database } from '@/lib/database.types';

// Mock dependencies
jest.mock('@/app/(app)/activities/_actions', () => ({
  deleteActivity: jest.fn(),
}));

jest.mock('@/components/weather/WeatherBadge', () => ({
  WeatherBadge: ({ tempF, description }: { tempF?: number; description?: string }) => (
    <div data-testid="weather-badge">
      {tempF ? `${tempF}°F` : ''} {description}
    </div>
  ),
}));

jest.mock('@/components/activities/DeleteActivityDialog', () => ({
  DeleteActivityDialog: () => <button data-testid="delete-dialog">Delete</button>,
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

type ActivityRow = Tables<'activities'> & { locations?: { name?: string | null } | null };

describe('ActivityListItem', () => {
  const mockActivity: Partial<ActivityRow> = {
    id: 123,
    activity_type: 'irrigation' as Database['public']['Enums']['activity_type'],
    started_at: '2023-10-27T10:00:00Z',
    labor_hours: 2.5,
    location_id: null,
    notes: 'Test notes',
    crop: 'Tomato',
    asset_name: 'Field A',
    locations: { name: 'Main Garden' },
    weather: {
      current: {
        temp: 75,
        weather: {
          icon: '01d',
          description: 'sunny',
        },
      },
    },
  };

  // We need to cast mockActivity to ActivityRow because Partial<ActivityRow> might miss required fields
  // that the component expects, but for testing purposes we know we provided enough.
  // However, to avoid 'any', we can use a type assertion that is safer than 'any'.
  const activity = mockActivity as ActivityRow;

  it('renders basic activity information', () => {
    render(<ActivityListItem activity={activity} />);

    // Check date formatting (simple check for part of the string)
    expect(screen.getByText(/2023-10-27 10:00/)).toBeInTheDocument();

    // Check labor hours badge
    expect(screen.getByText('2.5h')).toBeInTheDocument();

    // Check location
    expect(screen.getByText(/Location: Main Garden/)).toBeInTheDocument();

    // Check crop
    expect(screen.getByText(/Crop: Tomato/)).toBeInTheDocument();

    // Check asset
    expect(screen.getByText(/Asset: Field A/)).toBeInTheDocument();

    // Check notes
    expect(screen.getByText('Test notes')).toBeInTheDocument();
  });

  it('renders weather badge with correct props', () => {
    render(<ActivityListItem activity={activity} />);
    const weatherBadge = screen.getByTestId('weather-badge');
    expect(weatherBadge).toHaveTextContent('75°F sunny');
  });

  it('renders type badge when showTypeBadge is true', () => {
    render(<ActivityListItem activity={activity} showTypeBadge={true} />);

    // Should show the activity type badge
    expect(screen.getByText('irrigation')).toBeInTheDocument();

    // Should NOT show the "2.5h" badge in the header (it moves to the details line)
    expect(screen.getByText(/Hours: 2.5/)).toBeInTheDocument();
  });

  it('renders edit link correctly', () => {
    render(<ActivityListItem activity={activity} />);
    const editLink = screen.getByRole('link', { name: /edit/i });
    expect(editLink).toHaveAttribute('href', '/activities/123/edit');
  });

  it('renders delete dialog', () => {
    render(<ActivityListItem activity={activity} />);
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });

  it('handles missing optional data gracefully', () => {
    const minimalActivity = {
      ...mockActivity,
      labor_hours: null,
      notes: null,
      crop: null,
      asset_name: null,
      locations: null,
      weather: null,
    } as ActivityRow;

    render(<ActivityListItem activity={minimalActivity} />);

    // Should still render date
    expect(screen.getByText(/2023-10-27 10:00/)).toBeInTheDocument();

    // Should not render missing fields
    expect(screen.queryByText(/Location:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crop:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asset:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Test notes/)).not.toBeInTheDocument();
  });
});
