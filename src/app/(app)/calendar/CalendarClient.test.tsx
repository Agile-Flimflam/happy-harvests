import { render, screen, fireEvent } from '@testing-library/react';
import CalendarClient from './CalendarClient';
import '@testing-library/jest-dom';
import type { CalendarEvent, CalendarLocation } from './types';
import React from 'react';

// Mock dependencies
jest.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronsLeft: () => <span data-testid="icon-chevrons-left" />,
  ChevronsRight: () => <span data-testid="icon-chevrons-right" />,
  CalendarDays: () => <span data-testid="icon-calendar-days" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  CalendarRange: () => <span data-testid="icon-calendar-range" />,
  Droplet: () => <span />,
  Sprout: () => <span />,
  Wrench: () => <span />,
  Bug: () => <span />,
  FlaskConical: () => <span />,
  ShoppingBasket: () => <span />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div onClick={onClick} role="menuitem">
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}));

jest.mock('./_components/DayCell', () => ({
  DayCell: ({
    date,
    events,
    onOpenDetail,
  }: {
    date: Date;
    events: unknown[];
    onOpenDetail: (d: string) => void;
  }) => (
    <div data-testid="day-cell" onClick={() => onOpenDetail(date.toISOString().split('T')[0])}>
      {date.getDate()}
      {events.length > 0 && <span data-testid="event-indicator">{events.length}</span>}
    </div>
  ),
}));

jest.mock('./_components/DayDetailDialog', () => ({
  DayDetailDialog: ({ dateISO }: { dateISO: string }) => (
    <div data-testid="day-detail-dialog">{dateISO}</div>
  ),
}));

jest.mock('./CalendarHeaderWeather', () => ({
  __esModule: true,
  default: () => <div data-testid="calendar-header-weather" />,
}));

describe('CalendarClient', () => {
  const mockEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'Plant Tomatoes',
      start: '2023-10-27',
      type: 'planting',
    },
  ];

  const mockLocations: CalendarLocation[] = [
    { id: 'loc1', name: 'Garden', latitude: 10, longitude: 20 },
  ];

  beforeEach(() => {
    // Mock Date to a fixed date so tests are deterministic
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-10-27T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the calendar header with correct month', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);
    expect(screen.getAllByText('October 2023').length).toBeGreaterThan(0);
  });

  it('renders day cells', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);
    const cells = screen.getAllByTestId('day-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('navigates to previous month', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);

    const prevButtons = screen.getAllByLabelText('Previous');
    fireEvent.click(prevButtons[0]);

    expect(screen.getAllByText('September 2023').length).toBeGreaterThan(0);
  });

  it('navigates to next month', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);

    const nextButtons = screen.getAllByLabelText('Next');
    fireEvent.click(nextButtons[0]);

    expect(screen.getAllByText('November 2023').length).toBeGreaterThan(0);
  });

  it('opens detail dialog when clicking a day', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);

    // Find the cell for the 27th (which is today in our mock)
    // Since DayCell renders just the date number, we look for text "27"
    // But there might be multiple "27"s (prev/next month).
    // However, since we are in Oct 2023, 27 is in the current month.

    // Let's just click the first cell to be safe, or find one with events
    const cells = screen.getAllByTestId('day-cell');
    fireEvent.click(cells[15]); // Click random cell

    expect(screen.getByTestId('day-detail-dialog')).toBeInTheDocument();
  });

  it('filters events', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);

    // Check if filter buttons are present (we might have duplicates due to mobile/desktop layouts)
    const allButtons = screen.getAllByText('All');
    expect(allButtons.length).toBeGreaterThan(0);

    // Click 'Plantings' filter (desktop version is likely the second one if mobile is first in DOM, or vice versa)
    // We can just click the first one we find
    const plantingsButtons = screen.getAllByText('Plantings');
    fireEvent.click(plantingsButtons[0]);
  });

  it('switches view ranges', () => {
    render(<CalendarClient events={mockEvents} locations={mockLocations} />);

    // Switch to Week view
    const weekButtons = screen.getAllByText('Week');
    fireEvent.click(weekButtons[0]);

    // Switch to Today view (range selector, not the "Today" button which jumps to current date)
    const todayButtons = screen.getAllByText('Today');
    fireEvent.click(todayButtons[0]);

    // Switch back to Month view
    const monthButtons = screen.getAllByText('Month');
    fireEvent.click(monthButtons[0]);
  });
});
