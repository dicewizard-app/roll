type OperatorType = "PLUS" | "MINUS" | "STAR" | "SLASH";
type DiceModifierType = "KEEP_HIGHEST" | "KEEP_LOWEST";
type TokenType =
  | OperatorType
  | DiceModifierType
  | "NUMBER"
  | "DICE"
  | "PAREN_OPEN"
  | "PAREN_CLOSE"
  | "EOF";

function isDigit(char: string) {
  return char >= "0" && char <= "9";
}

type BaseToken<T extends TokenType = TokenType> = {
  type: T;
  lexeme: string;
  offset: number;
};

type NumberToken = BaseToken<"NUMBER"> & {
  literal: number;
};

type Token<T extends TokenType = TokenType> = T extends "NUMBER"
  ? NumberToken
  : BaseToken<T>;

function lex(expression: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  const errors: DiceNotationError[] = [];

  while (offset < expression.length) {
    const char = expression[offset];

    if (char.match(/\s/)) {
      offset++;
    } else if (isDigit(char)) {
      const start = offset;

      while (isDigit(expression[offset])) {
        offset++;
      }

      const number = expression.slice(start, offset);

      tokens.push({
        type: "NUMBER",
        lexeme: number,
        literal: parseInt(number),
        offset: start,
      });
    } else if (char === "d") {
      const start = offset;

      offset++;

      tokens.push({
        type: "DICE",
        lexeme: expression.slice(start, offset),
        offset: start,
      });
    } else if (char === "+") {
      tokens.push({ type: "PLUS", lexeme: "+", offset });
      offset++;
    } else if (char === "-") {
      tokens.push({ type: "MINUS", lexeme: "-", offset });
      offset++;
    } else if (char === "*") {
      tokens.push({ type: "STAR", lexeme: "*", offset });
      offset++;
    } else if (char === "/") {
      tokens.push({ type: "SLASH", lexeme: "/", offset });
      offset++;
    } else if (char === "(") {
      tokens.push({ type: "PAREN_OPEN", lexeme: "(", offset });
      offset++;
    } else if (char === ")") {
      tokens.push({ type: "PAREN_CLOSE", lexeme: ")", offset });
      offset++;
    } else if (char === "k") {
      offset++;
      switch (expression[offset]) {
        case "h":
          tokens.push({ type: "KEEP_HIGHEST", lexeme: "kh", offset });
          offset++;
          break;
        case "l":
          tokens.push({ type: "KEEP_LOWEST", lexeme: "kh", offset });
          offset++;
          break;
        default:
          errors.push(
            new DiceNotationError(`Unexpected ${char}`, expression, offset)
          );
          break;
      }
    } else if (char === "h") {
      tokens.push({ type: "KEEP_HIGHEST", lexeme: char, offset });
      offset++;
    } else if (char === "l") {
      tokens.push({ type: "KEEP_LOWEST", lexeme: char, offset });
      offset++;
    } else {
      errors.push(
        new DiceNotationError(`Unexpected '${char}'!`, expression, offset)
      );
      offset++;
    }
  }

  if (errors.length > 0) {
    throw errors[0];
  }

  tokens.push({ type: "EOF", lexeme: "", offset });

  return tokens;
}

type NumberNode = {
  type: "NUMBER";
  value: number;
};

type DiceNode = {
  type: "DICE";
  numDice: number;
  numSides: number;
};

type BinaryOpNode = {
  type: "BINARY_OP";
  left: ASTNode;
  operator: OperatorType;
  right: ASTNode;
};

type DiceModifierNode = {
  type: "DICE_BINARY_OP";
  left: DiceNode;
  operator: DiceModifierType;
  right: ASTNode;
};

type GroupingNode = {
  type: "GROUPING";
  expression: ASTNode;
};

type ASTNode =
  | NumberNode
  | DiceNode
  | BinaryOpNode
  | GroupingNode
  | DiceModifierNode;

function parse(tokens: Token[]): ASTNode {
  let current = 0;

  function advance() {
    const token = peek();
    current++;
    return token;
  }

  function peek(): Token {
    return tokens[current];
  }
  function previous(): Token {
    return tokens[current - 1];
  }

  function match(...types: TokenType[]): boolean {
    const token = peek();

    if (types.includes(token.type)) {
      advance();
      return true;
    }

    return false;
  }

  function expect<T extends TokenType>(type: T): Token<T> {
    if (peek().type === type) {
      return advance() as Token<T>;
    }

    throw new Error(`Expected ${type} at offset ${peek().offset}`);
  }

  function term(): ASTNode {
    let expr = factor();

    while (match("MINUS", "PLUS")) {
      const operator = previous().type as OperatorType;
      const right = factor();
      expr = {
        type: "BINARY_OP",
        left: expr,
        operator,
        right,
      };
    }
    return expr;
  }

  function factor(): ASTNode {
    let expr = primary();
    while (match("STAR", "SLASH")) {
      const operator = previous().type as OperatorType;
      const right = primary();
      expr = {
        type: "BINARY_OP",
        left: expr,
        operator,
        right,
      };
    }
    return expr;
  }

  function primary(): ASTNode {
    if (
      peek().type === "DICE" ||
      (peek().type === "NUMBER" && tokens[current + 1]?.type === "DICE")
    ) {
      return dice();
    }

    if (match("NUMBER")) {
      const num = (previous() as NumberToken).literal;

      return {
        type: "NUMBER",
        value: num,
      };
    }

    if (match("DICE")) {
      const numSides = expect("NUMBER").literal;
      return {
        type: "DICE",
        numDice: 1,
        numSides,
      };
    }

    if (match("PAREN_OPEN")) {
      const expr = term();
      expect("PAREN_CLOSE");
      return {
        type: "GROUPING",
        expression: expr,
      };
    }

    const token = peek();
    throw new Error(`Unexpected ${token.type} at offset ${token.offset}`);
  }

  function dice(): ASTNode {
    const numDice = match("NUMBER") ? (previous() as NumberToken).literal : 1;
    expect("DICE");
    const numSides = expect("NUMBER").literal;

    const dice = {
      type: "DICE",
      numDice,
      numSides,
    } as const;

    if (match("KEEP_HIGHEST", "KEEP_LOWEST")) {
      return {
        type: "DICE_BINARY_OP",
        left: dice,
        operator: previous().type as DiceModifierType,
        right: primary(),
      };
    }
    return dice;
  }

  const ast = term();
  if (peek().type !== "EOF") {
    console.warn("Could not parse whole expression");
  }
  return ast;
}

type Result = {
  result: number;
  rolls?: number[];
  children?: Result[];
  explanation: string;
};

function evaluate(node: ASTNode, random: Random): Result {
  switch (node.type) {
    case "NUMBER":{

      return { result: node.value, explanation: `${node.value}` };
    }
    case "DICE":{

      const { numDice, numSides } = node;

      const rolls = Array.from({ length: numDice }, () => random(numSides));

      const total = rolls.reduce((a, b) => a + b, 0);

      return {
        result: total,
        rolls,
        explanation: `[${rolls.join(" + ")}]`,
      };
    }
    case "BINARY_OP":{

      const left = evaluate(node.left, random);
      const right = evaluate(node.right, random);

      let value: number;
      let opExplanation: string;
      switch (node.operator) {
        case "PLUS":
          value = left.result + right.result;
          opExplanation = "+";
          break;
        case "MINUS":
          value = left.result - right.result;
          opExplanation = "-";
          break;
        case "STAR":
          value = left.result * right.result;
          opExplanation = "*";
          break;
        case "SLASH":
          value = left.result / right.result;
          opExplanation = "/";
          break;
        default:
          throw new Error(`Unexpected node ${node}`);
      }

      return {
        result: value,
        explanation: `${left.explanation ?? left.result} ${opExplanation} ${
          right.explanation ?? right.result
        }`,
      };
    }

    case "DICE_BINARY_OP": {
      const left = evaluate(node.left, random);
      const right = evaluate(node.right, random);

      const rolls = left.rolls!.toSorted((a, b) => a - b);

      switch (node.operator) {
        case "KEEP_HIGHEST":
          return {
            result: sum(rolls.slice(-right.result)),
            explanation: `${left.explanation ?? left.result}kh${
              right.explanation ?? right.result
            }`,
          };
        case "KEEP_LOWEST":
          return {
            result: sum(rolls.slice(0, right.result)),
            explanation: `${left.explanation ?? left.result}kl${
              right.explanation ?? right.result
            }`,
          };
        default:
          throw new Error(`Unexpected node ${node}`);
      }
    }
    case "GROUPING": {
      const result = evaluate(node.expression, random);

      return {
        result: result.result,
        rolls: result.rolls,
        explanation: `(${result.explanation})`,
      };
    }
    default: {
      throw new Error(`Unexpected node ${node}`);
    }
  }
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

type Random = (max: number) => number;

const defaultRandom: Random = (max) => 1 + Math.floor(Math.random() * max);

export function roll(
  expression: string,
  {
    random = defaultRandom,
    maxRolls,
  }: { random?: Random; maxRolls?: number } = {}
): Result {
  const tokens = lex(expression);
  const ast = parse(tokens);

  if (maxRolls) {
    const rolls = countRolls(ast);
    if (rolls > maxRolls) {
      throw new TooManyDiceError(rolls);
    }
  }

  const result = evaluate(ast, random);
  return result;
}

function countRolls(ast: ASTNode): number {
  switch (ast.type) {
    case "NUMBER": {
      return 1;
    }
    case "DICE": {
      return ast.numDice;
    }
    case "BINARY_OP": {
      return countRolls(ast.left) + countRolls(ast.right);
    }
    case "DICE_BINARY_OP": {
      return countRolls(ast.left) + countRolls(ast.right);
    }
    case "GROUPING": {
      return countRolls(ast.expression);
    }
    default: {
      console.warn("Cannot count on unknown node", ast);
      return 0;
    }
  }
}

export class RollError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
  }
}
export class TooManyDiceError extends RollError {
  constructor(public dice: number) {
    super(`Too many dice (${dice})!`);
  }
}

export class DiceNotationError extends RollError {
  constructor(
    message: string,
    public expression: string,
    public offset: number
  ) {
    console.log(`^${Array(offset).fill(" ").join("")}^`);
    super(`Error: ${message}
\`\`\`
${expression}
${Array(offset).fill(" ").join("")}^
\`\`\`
`);
  }
}
