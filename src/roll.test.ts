import { roll } from "./roll.ts";
import { expect, test } from "vitest";

function sequence(numbers: number[]) {
  const generator = (function* () {
    for (const number of numbers) {
      yield number;
    }
  })();

  return (_max: number) => generator.next().value as number;
}

test("single dice roll", () => {
  const result = roll("1d20", { random: sequence([15]) });
  expect(result.result).toBe(15);
});

test("dice quantity can be omitted", () => {
  const result = roll("2d6 + d8", { random: sequence([1, 2, 5]) });
  expect(result.result).toBe(8);
});

test("constants can be used", () => {
  const result = roll("1d6 + 2", { random: sequence([4]) });
  expect(result.result).toBe(6);
});

test("addition", () => {
  const result = roll("1 + 2");
  expect(result.result).toBe(3);
});

test("subtraction", () => {
  const result = roll("3 - 2");
  expect(result.result).toBe(1);
});

test("multiplication", () => {
  const result = roll("2 * 3");
  expect(result.result).toBe(6);
});

test("division", () => {
  const result = roll("6 / 2");
  expect(result.result).toBe(3);
});

test("precedence", () => {
  const result1 = roll("2 * 3 + 1");
  expect(result1.result).toBe(7);

  const result2 = roll("1 + 2 * 3");
  expect(result2.result).toBe(7);
});

test("parentheses", () => {
  const result = roll("(1 + 2) * 3");
  expect(result.result).toBe(9);
});

test("kh should keep highest rolls", () => {
  // [1, 2, 5]kh1 -> 5
  const result = roll("3d6kh1", { random: sequence([1, 2, 5]) });
  expect(result.result).toBe(5);
});

test("kh should keep highest roll", () => {
  // [1, 2, 5]kh1 -> 5
  const result = roll("2d20kh1", { random: sequence([8, 15]) });
  expect(result.result).toBe(15);
});

test("kl should keep lowest rolls", () => {
  // [1, 2, 5]kl2 -> 1 + 2 -> 3
  const result = roll("3d6kl2", { random: sequence([1, 2, 5]) });
  expect(result.result).toBe(3);
});
