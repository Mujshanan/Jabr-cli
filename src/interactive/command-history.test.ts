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

  it("skips consecutive duplicate commands but keeps non-consecutive repeats", () => {
    const history = new CommandHistory();
    history.add("help");
    history.add("help");
    history.add("version");
    history.add("help");

    expect(history.length).toBe(3);
    expect(history.previous("")).toBe("help");
    expect(history.previous("help")).toBe("version");
    expect(history.previous("version")).toBe("help");
  });

  it("keeps only the newest 100 commands", () => {
    const history = new CommandHistory();
    for (let index = 0; index < 105; index += 1) {
      history.add(`command-${index}`);
    }

    expect(history.length).toBe(100);
    expect(history.previous("")).toBe("command-104");
    for (let index = 0; index < 99; index += 1) {
      history.previous("");
    }
    expect(history.previous("")).toBe("command-5");
  });
});
