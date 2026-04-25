import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "./page";
import { eventsAPI } from "@/lib/api";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@/lib/api", () => ({
  eventsAPI: {
    list: jest.fn(),
  },
}));

describe("frontend test setup", () => {
  it("renders the homepage and loads events", async () => {
    (eventsAPI.list as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: "event-1",
          name: "Sanity Check Event",
          category: "MUSIC",
          date: "2026-06-15T00:00:00.000Z",
          time: "2026-06-15T19:30:00.000Z",
          venue: "Test Arena",
          price: 49.99,
          capacity: 100,
          soldCount: 10,
          imageUrl: null,
          artistInfo: "Test Artist",
        },
      ],
    });

    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /discover amazing events/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(eventsAPI.list).toHaveBeenCalledWith(undefined);
    });

    expect(await screen.findByText("Sanity Check Event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get tickets/i })).toBeInTheDocument();
  });
});
