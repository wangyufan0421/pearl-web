import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CommunityAvatar, CommunityAuthorInfo } from "./CommunityIdentity";
afterEach(cleanup);
it("keeps a linked account ID when fetched identity is missing or the avatar fails", () => {
  const source = { url: "https://x.com/blocmates/status/123", xStatusId: "123", author: null, handle: null, avatarUrl: "https://pbs.twimg.com/avatar.jpg" };
  render(<><CommunityAvatar source={source} /><CommunityAuthorInfo source={source} /></>);
  expect(screen.getByRole("link", { name: "@blocmates" })).toHaveAttribute("href", "https://x.com/blocmates");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "@blocmates" })).toBeInTheDocument();
});
