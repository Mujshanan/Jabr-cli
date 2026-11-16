import { describe, expect, it } from "vitest";
import { CommandHistory } from "./command-history";

describe("CommandHistory", () => {
  it("returns commands from newest to oldest and stops at the oldest", () => {
    const history = new CommandHistory();
    history.add("help");
    history.add("ast 2*x");

    expect(history.previous("")).toBe("ast 2*x");
    expect(history.previous("ast 2*x")).toBe("help");
    expect(history.previous("help")).toBe("help");
  });

  it("restores the current draft when moving down past the newest entry", () => {
    const history = new CommandHistory();
    history.add("help");
    history.add("version");

    expect(history.previous("unfinished command")).toBe("version");
    expect(history.previous("version")).toBe("help");
    expect(history.next()).toBe("version");
    expect(history.next()).toBe("unfinished command");
  });

  it("ignores blank commands and supports returning to the end", () => {
    const history = new CommandHistory();
    history.add("  ");
    history.add("help");

    expect(history.length).toBe(1);
    expect(history.previous("")).toBe("help");
    history.resetNavigation();
    expect(history.next()).toBe("");
  });

  it("keeps duplicate commands as separate history entries", () => {
    const history = new CommandHistory();
    history.add("help");
    history.add("help");

    expect(history.previous("")).toBe("help");
    expect(history.previous("help")).toBe("help");
    expect(history.length).toBe(2);
  });
});
