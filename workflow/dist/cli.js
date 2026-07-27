#!/usr/bin/env node

// node_modules/@jsr/cliffy__internal/runtime/get_args.js
function getArgs() {
  const { Deno: Deno2, process: process2, Bun } = globalThis;
  return Deno2?.args ?? Bun?.argv.slice(2) ?? process2?.argv.slice(2) ?? [];
}

// node_modules/@jsr/std__text/levenshtein_distance.js
var { ceil } = Math;
var peq = new Uint32Array(1114112);
function myers32(t, p) {
  const n = t.length;
  const m = p.length;
  for (let i = 0; i < m; i++) {
    peq[p[i].codePointAt(0)] |= 1 << i;
  }
  const last = m - 1;
  let pv = -1;
  let mv = 0;
  let score = m;
  for (let j = 0; j < n; j++) {
    const eq = peq[t[j].codePointAt(0)];
    const xv = eq | mv;
    const xh = (eq & pv) + pv ^ pv | eq;
    let ph = mv | ~(xh | pv);
    let mh = pv & xh;
    score += (ph >>> last & 1) - (mh >>> last & 1);
    ph = ph << 1 | 1;
    mh = mh << 1;
    pv = mh | ~(xv | ph);
    mv = ph & xv;
  }
  for (let i = 0; i < m; i++) {
    peq[p[i].codePointAt(0)] = 0;
  }
  return score;
}
function myersX(t, p) {
  const n = t.length;
  const m = p.length;
  const h = new Int8Array(n).fill(1);
  const bmax = ceil(m / 32) - 1;
  for (let b = 0; b < bmax; b++) {
    const start2 = b * 32;
    const end = (b + 1) * 32;
    for (let i = start2; i < end; i++) {
      peq[p[i].codePointAt(0)] |= 1 << i;
    }
    let pv2 = -1;
    let mv2 = 0;
    for (let j = 0; j < n; j++) {
      const hin = h[j];
      let eq = peq[t[j].codePointAt(0)];
      const xv = eq | mv2;
      eq |= hin >>> 31;
      const xh = (eq & pv2) + pv2 ^ pv2 | eq;
      let ph = mv2 | ~(xh | pv2);
      let mh = pv2 & xh;
      h[j] = (ph >>> 31) - (mh >>> 31);
      ph = ph << 1 | -hin >>> 31;
      mh = mh << 1 | hin >>> 31;
      pv2 = mh | ~(xv | ph);
      mv2 = ph & xv;
    }
    for (let i = start2; i < end; i++) {
      peq[p[i].codePointAt(0)] = 0;
    }
  }
  const start = bmax * 32;
  for (let i = start; i < m; i++) {
    peq[p[i].codePointAt(0)] |= 1 << i;
  }
  const last = m - 1;
  let pv = -1;
  let mv = 0;
  let score = m;
  for (let j = 0; j < n; j++) {
    const hin = h[j];
    let eq = peq[t[j].codePointAt(0)];
    const xv = eq | mv;
    eq |= hin >>> 31;
    const xh = (eq & pv) + pv ^ pv | eq;
    let ph = mv | ~(xh | pv);
    let mh = pv & xh;
    score += (ph >>> last & 1) - (mh >>> last & 1);
    ph = ph << 1 | -hin >>> 31;
    mh = mh << 1 | hin >>> 31;
    pv = mh | ~(xv | ph);
    mv = ph & xv;
  }
  for (let i = start; i < m; i++) {
    peq[p[i].codePointAt(0)] = 0;
  }
  return score;
}
function levenshteinDistance(str1, str2) {
  let t = [
    ...str1
  ];
  let p = [
    ...str2
  ];
  if (t.length < p.length) {
    [p, t] = [
      t,
      p
    ];
  }
  if (p.length === 0) {
    return t.length;
  }
  return p.length <= 32 ? myers32(t, p) : myersX(t, p);
}

// node_modules/@jsr/std__text/closest_string.js
function closestString(givenWord, possibleWords, options) {
  if (possibleWords.length === 0) {
    throw new TypeError("When using closestString(), the possibleWords array must contain at least one word");
  }
  const { caseSensitive, compareFn = levenshteinDistance } = {
    ...options
  };
  if (!caseSensitive) {
    givenWord = givenWord.toLowerCase();
  }
  let nearestWord = possibleWords[0];
  let closestStringDistance = Infinity;
  for (const each of possibleWords) {
    const distance = caseSensitive ? compareFn(givenWord, each) : compareFn(givenWord, each.toLowerCase());
    if (distance < closestStringDistance) {
      nearestWord = each;
      closestStringDistance = distance;
    }
  }
  return nearestWord;
}

// node_modules/@jsr/cliffy__flags/_utils.js
function paramCaseToCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
function getOption(flags, name) {
  while (name[0] === "-") {
    name = name.slice(1);
  }
  for (const flag of flags) {
    if (isOption(flag, name)) {
      return flag;
    }
  }
  return;
}
function didYouMeanOption(option, options) {
  const optionNames = options.map((option2) => [
    option2.name,
    ...option2.aliases ?? []
  ]).flat().map((option2) => getFlag(option2));
  return didYouMean(" Did you mean option", getFlag(option), optionNames);
}
function didYouMeanType(type, types) {
  return didYouMean(" Did you mean type", type, types);
}
function didYouMean(message, type, types) {
  const match = types.length ? closestString(type, types) : void 0;
  return match ? `${message} "${match}"?` : "";
}
function getFlag(name) {
  if (name.startsWith("-")) {
    return name;
  }
  if (name.length > 1) {
    return `--${name}`;
  }
  return `-${name}`;
}
function isOption(option, name) {
  return option.name === name || option.aliases && option.aliases.indexOf(name) !== -1;
}
function matchWildCardOptions(name, flags) {
  for (const option of flags) {
    if (option.name.indexOf("*") === -1) {
      continue;
    }
    let matched = matchWildCardOption(name, option);
    if (matched) {
      matched = {
        ...matched,
        name
      };
      flags.push(matched);
      return matched;
    }
  }
}
function matchWildCardOption(name, option) {
  const parts = option.name.split(".");
  const parts2 = name.split(".");
  if (parts.length !== parts2.length) {
    return false;
  }
  const count2 = Math.max(parts.length, parts2.length);
  for (let i = 0; i < count2; i++) {
    if (parts[i] !== parts2[i] && parts[i] !== "*") {
      return false;
    }
  }
  return option;
}
function getDefaultValues(option) {
  const values = option.args?.map((arg) => getDefaultValue(arg)) ?? [];
  while (values.length > 1 && values.at(-1) === void 0) {
    values.pop();
  }
  return values.length ? values : void 0;
}
function getDefaultValue(option) {
  return typeof option.default === "function" ? option.default() : option.default !== void 0 ? option.default : "args" in option && option.args?.some((arg) => arg.default !== void 0) ? getDefaultValues(option) : void 0;
}

// node_modules/@jsr/cliffy__flags/_errors.js
var FlagsError = class _FlagsError extends Error {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, _FlagsError.prototype);
  }
};
var UnknownRequiredOptionError = class _UnknownRequiredOptionError extends FlagsError {
  constructor(option, options) {
    super(`Unknown required option "${getFlag(option)}".${didYouMeanOption(option, options)}`);
    Object.setPrototypeOf(this, _UnknownRequiredOptionError.prototype);
  }
};
var UnknownConflictingOptionError = class _UnknownConflictingOptionError extends FlagsError {
  constructor(option, options) {
    super(`Unknown conflicting option "${getFlag(option)}".${didYouMeanOption(option, options)}`);
    Object.setPrototypeOf(this, _UnknownConflictingOptionError.prototype);
  }
};
var UnknownTypeError = class _UnknownTypeError extends FlagsError {
  constructor(type, types) {
    super(`Unknown type "${type}".${didYouMeanType(type, types)}`);
    Object.setPrototypeOf(this, _UnknownTypeError.prototype);
  }
};
var ValidationError = class _ValidationError extends FlagsError {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
var DuplicateOptionError = class _DuplicateOptionError extends ValidationError {
  constructor(name) {
    super(`Option "${getFlag(name).replace(/^--no-/, "--")}" can only occur once, but was found several times.`);
    Object.setPrototypeOf(this, _DuplicateOptionError.prototype);
  }
};
var UnknownOptionError = class _UnknownOptionError extends ValidationError {
  constructor(option, options) {
    super(`Unknown option "${getFlag(option)}".${didYouMeanOption(option, options)}`);
    Object.setPrototypeOf(this, _UnknownOptionError.prototype);
  }
};
var MissingOptionValueError = class _MissingOptionValueError extends ValidationError {
  constructor(option) {
    super(`Missing value for option "${getFlag(option)}".`);
    Object.setPrototypeOf(this, _MissingOptionValueError.prototype);
  }
};
var InvalidOptionValueError = class _InvalidOptionValueError extends ValidationError {
  constructor(option, expected, value) {
    super(`Option "${getFlag(option)}" must be of type "${expected}", but got "${value}".`);
    Object.setPrototypeOf(this, _InvalidOptionValueError.prototype);
  }
};
var UnexpectedOptionValueError = class _UnexpectedOptionValueError extends ValidationError {
  constructor(option, value) {
    super(`Option "${getFlag(option)}" doesn't take a value, but got "${value}".`);
    Object.setPrototypeOf(this, _UnexpectedOptionValueError.prototype);
  }
};
var OptionNotCombinableError = class _OptionNotCombinableError extends ValidationError {
  constructor(option) {
    super(`Option "${getFlag(option)}" cannot be combined with other options.`);
    Object.setPrototypeOf(this, _OptionNotCombinableError.prototype);
  }
};
var ConflictingOptionError = class _ConflictingOptionError extends ValidationError {
  constructor(option, conflictingOption) {
    super(`Option "${getFlag(option)}" conflicts with option "${getFlag(conflictingOption)}".`);
    Object.setPrototypeOf(this, _ConflictingOptionError.prototype);
  }
};
var DependingOptionError = class _DependingOptionError extends ValidationError {
  constructor(option, dependingOption) {
    super(`Option "${getFlag(option)}" depends on option "${getFlag(dependingOption)}".`);
    Object.setPrototypeOf(this, _DependingOptionError.prototype);
  }
};
var MissingRequiredOptionError = class _MissingRequiredOptionError extends ValidationError {
  constructor(option) {
    super(`Missing required option "${getFlag(option)}".`);
    Object.setPrototypeOf(this, _MissingRequiredOptionError.prototype);
  }
};
var UnexpectedRequiredArgumentError = class _UnexpectedRequiredArgumentError extends ValidationError {
  constructor(arg) {
    super(`An required argument cannot follow an optional argument, but "${arg}"  is defined as required.`);
    Object.setPrototypeOf(this, _UnexpectedRequiredArgumentError.prototype);
  }
};
var UnexpectedArgumentAfterVariadicArgumentError = class _UnexpectedArgumentAfterVariadicArgumentError extends ValidationError {
  constructor(arg) {
    super(`An argument cannot follow an variadic argument, but got "${arg}".`);
    Object.setPrototypeOf(this, _UnexpectedArgumentAfterVariadicArgumentError.prototype);
  }
};
var InvalidTypeError = class _InvalidTypeError extends ValidationError {
  constructor({ label, name, value, type }, expected) {
    super(`${label} "${name}" must be of type "${type}", but got "${value}".` + (expected ? ` Expected values: ${expected.map((value2) => `"${value2}"`).join(", ")}` : ""));
    Object.setPrototypeOf(this, _InvalidTypeError.prototype);
  }
};
var MissingArgumentError = class _MissingArgumentError extends ValidationError {
  constructor(name) {
    super(`Missing argument: ${name}`);
    Object.setPrototypeOf(this, _MissingArgumentError.prototype);
  }
};
var MissingArgumentsError = class _MissingArgumentsError extends ValidationError {
  constructor(names) {
    super(`Missing argument(s): ${names.join(", ")}`);
    Object.setPrototypeOf(this, _MissingArgumentsError.prototype);
  }
};
var TooManyArgumentsError = class _TooManyArgumentsError extends ValidationError {
  constructor(args) {
    super(`Too many arguments: ${args.join(" ")}`);
    Object.setPrototypeOf(this, _TooManyArgumentsError.prototype);
  }
};

// node_modules/@jsr/cliffy__flags/types/boolean.js
var boolean = (type) => {
  if (~[
    "1",
    "true"
  ].indexOf(type.value)) {
    return true;
  }
  if (~[
    "0",
    "false"
  ].indexOf(type.value)) {
    return false;
  }
  throw new InvalidTypeError(type, [
    "true",
    "false",
    "1",
    "0"
  ]);
};

// node_modules/@jsr/cliffy__flags/types/number.js
var number = (type) => {
  if (type.value) {
    const value = Number(type.value);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  throw new InvalidTypeError(type);
};

// node_modules/@jsr/cliffy__flags/types/string.js
var string = ({ value }) => {
  return value;
};

// node_modules/@jsr/cliffy__flags/_validate_flags.js
function validateFlags(ctx, opts, options = /* @__PURE__ */ new Map()) {
  if (!opts.flags) {
    return;
  }
  setDefaultValues(ctx, opts);
  const optionNames = Object.keys(ctx.flags);
  if (!optionNames.length && opts.allowEmpty) {
    return;
  }
  if (ctx.standalone) {
    validateStandaloneOption(ctx, options, optionNames);
    return;
  }
  for (const [name, option] of options) {
    validateUnknownOption(option, opts);
    validateConflictingOptions(ctx, option, opts);
    validateDependingOptions(ctx, option, opts);
    validateRequiredValues(ctx, option, name);
  }
  validateRequiredOptions(ctx, options, opts);
}
function validateUnknownOption(option, opts) {
  if (!getOption(opts.flags ?? [], option.name)) {
    throw new UnknownOptionError(option.name, opts.flags ?? []);
  }
}
function setDefaultValues(ctx, opts) {
  if (!opts.flags?.length) {
    return;
  }
  for (const option of opts.flags) {
    let name;
    let defaultValue = void 0;
    if (option.name.startsWith("no-")) {
      const propName = option.name.replace(/^no-/, "");
      if (typeof ctx.flags[propName] !== "undefined") {
        continue;
      }
      const positiveOption = getOption(opts.flags, propName);
      if (positiveOption) {
        continue;
      }
      name = paramCaseToCamelCase(propName);
      defaultValue = true;
    }
    if (!name) {
      name = paramCaseToCamelCase(option.name);
    }
    const hasDefaultValue = (!opts.ignoreDefaults || typeof opts.ignoreDefaults[name] === "undefined") && typeof ctx.flags[name] === "undefined" && (typeof option.default !== "undefined" || option.args?.some((arg) => arg.default !== void 0) || typeof defaultValue !== "undefined");
    if (hasDefaultValue) {
      ctx.flags[name] = getDefaultValue(option) ?? defaultValue;
      ctx.defaults[option.name] = true;
      if (typeof option.value === "function") {
        ctx.flags[name] = option.value(ctx.flags[name]);
      } else if (option.args?.length) {
        for (const [index, arg] of option.args.entries()) {
          if (typeof arg.value === "function") {
            ctx.flags[name][index] = arg.value(ctx.flags[name][index]);
          }
        }
      }
    }
  }
}
function validateStandaloneOption(ctx, options, optionNames) {
  if (!ctx.standalone || optionNames.length === 1) {
    return;
  }
  for (const [_, opt] of options) {
    if (!ctx.defaults[opt.name] && opt !== ctx.standalone) {
      throw new OptionNotCombinableError(ctx.standalone.name);
    }
  }
}
function validateConflictingOptions(ctx, option, opts) {
  if (!option.conflicts?.length) {
    return;
  }
  for (const flag of option.conflicts) {
    if (isExplicitlyProvided(flag, ctx, opts)) {
      throw new ConflictingOptionError(option.name, flag);
    }
  }
}
function isExplicitlyProvided(flag, ctx, opts) {
  const option = getOption(opts.flags ?? [], flag);
  const flagNames = [
    flag,
    ...option?.aliases ?? []
  ];
  const isProvidedAsArg = ctx.parsedFlags.some((arg) => {
    const name = arg.replace(/^-+/, "").split("=")[0];
    return flagNames.includes(name);
  });
  if (isProvidedAsArg) {
    return true;
  }
  return typeof opts.ignoreDefaults?.[paramCaseToCamelCase(flag)] !== "undefined";
}
function validateDependingOptions(ctx, option, opts) {
  if (!option.depends) {
    return;
  }
  for (const flag of option.depends) {
    if (!isset(flag, ctx.flags) && !ctx.defaults[option.name] && // TODO: remove ignoreDefaults if flags module has support for environment variables
    (!opts.ignoreDefaults || typeof opts.ignoreDefaults[flag] === "undefined")) {
      throw new DependingOptionError(option.name, flag);
    }
  }
}
function validateRequiredValues(ctx, option, name) {
  if (!option.args) {
    return;
  }
  const isArray = option.args.length > 1;
  for (let i = 0; i < option.args.length; i++) {
    const arg = option.args[i];
    if (arg.optional) {
      continue;
    }
    const hasValue = isArray ? typeof ctx.flags[name][i] !== "undefined" : typeof ctx.flags[name] !== "undefined";
    if (!hasValue) {
      throw new MissingOptionValueError(option.name);
    }
  }
}
function validateRequiredOptions(ctx, options, opts) {
  if (!opts.flags?.length) {
    return;
  }
  const optionsValues = [
    ...options.values()
  ];
  for (const option of opts.flags) {
    if (!option.required || paramCaseToCamelCase(option.name) in ctx.flags) {
      continue;
    }
    const conflicts = option.conflicts ?? [];
    const hasConflict = conflicts.find((flag) => !!ctx.flags[flag]);
    const hasConflicts = hasConflict || optionsValues.find((opt) => opt.conflicts?.find((flag) => flag === option.name));
    if (hasConflicts) {
      continue;
    }
    throw new MissingRequiredOptionError(option.name);
  }
}
function isset(flagName, flags) {
  const name = paramCaseToCamelCase(flagName);
  return typeof flags[name] !== "undefined";
}

// node_modules/@jsr/cliffy__flags/types/integer.js
var integer = (type) => {
  const value = Number(type.value);
  if (Number.isInteger(value)) {
    return value;
  }
  throw new InvalidTypeError(type);
};

// node_modules/@jsr/cliffy__flags/flags.js
var DefaultTypes = {
  string,
  number,
  integer,
  boolean
};
function parseFlags(argsOrCtx = getArgs(), opts = {}) {
  let args;
  let ctx;
  if (Array.isArray(argsOrCtx)) {
    ctx = {};
    args = argsOrCtx;
  } else {
    ctx = argsOrCtx;
    args = argsOrCtx.unknown;
    argsOrCtx.unknown = [];
  }
  args = args.slice();
  ctx.flags ??= {};
  ctx.literal ??= [];
  ctx.unknown ??= [];
  ctx.stopEarly = false;
  ctx.stopOnUnknown = false;
  ctx.defaults ??= {};
  ctx.parsedFlags ??= [];
  opts.dotted ??= true;
  validateOptions(opts);
  const options = parseArgs(ctx, args, opts);
  validateFlags(ctx, opts, options);
  validateArguments(ctx, opts, options);
  if (opts.dotted) {
    parseDottedOptions(ctx);
  }
  return ctx;
}
function validateOptions(opts) {
  opts.flags?.forEach((opt) => {
    opt.depends?.forEach((flag) => {
      if (!opts.flags || !getOption(opts.flags, flag)) {
        throw new UnknownRequiredOptionError(flag, opts.flags ?? []);
      }
    });
    opt.conflicts?.forEach((flag) => {
      if (!opts.flags || !getOption(opts.flags, flag)) {
        throw new UnknownConflictingOptionError(flag, opts.flags ?? []);
      }
    });
  });
}
function parseArgs(ctx, args, opts) {
  const optionsMap = /* @__PURE__ */ new Map();
  let inLiteral = false;
  let argIndex = 0;
  for (let argsIndex = 0; argsIndex < args.length; argsIndex++) {
    let parseNext = function(option2) {
      let skipOptionArgument = false;
      if (negate) {
        setFlagValue(false);
        return;
      } else if (!option2.args?.length) {
        setFlagValue(void 0);
        return;
      }
      const arg = option2.args[optionArgsIndex];
      if (!arg) {
        const flag = next();
        throw new UnknownOptionError(flag, opts.flags ?? []);
      }
      if (!arg.type) {
        arg.type = "boolean";
      }
      if (arg.optional) {
        inOptionalArg = true;
      } else if (inOptionalArg) {
        throw new UnexpectedRequiredArgumentError(option2.name);
      }
      let result;
      let increase = false;
      if (hasNext(arg) && (!option2.required || arg.optional) && next() === "") {
        if (arg.variadic) {
          skipOptionArgument = true;
        } else if (option2.args?.length === 1) {
          skipArgument = true;
        } else {
          result = "";
        }
        increase = true;
      } else if (arg.list && hasNext(arg)) {
        const parsed = parseListValue(opts, {
          label: "Option",
          name: `--${option2.name}`,
          type: arg.type || "string",
          value: next(),
          separator: arg.separator
        });
        if (parsed?.length) {
          result = parsed;
        }
        increase = true;
      } else {
        if (hasNext(arg)) {
          result = parseValue(opts, {
            label: "Option",
            name: `--${option2.name}`,
            type: arg.type || "string",
            value: next()
          });
          if (typeof result !== "undefined") {
            increase = true;
          }
        } else if (arg.optional && arg.type === "boolean") {
          result = true;
        }
      }
      if (increase && typeof currentValue === "undefined") {
        ctx.parsedFlags.push(args[argsIndex + 1]);
        argsIndex++;
        if (!arg.variadic) {
          optionArgsIndex++;
        } else if (option2.args[optionArgsIndex + 1]) {
          throw new UnexpectedArgumentAfterVariadicArgumentError(next());
        }
      }
      if (skipOptionArgument) {
        if (hasNext(arg)) {
          parseNext(option2);
        }
        return;
      }
      if (skipArgument) {
        return;
      }
      if (typeof result !== "undefined" && (option2.args.length > 1 || arg.variadic)) {
        if (!ctx.flags[propName]) {
          setFlagValue([]);
        }
        if (result === "") {
          result = void 0;
        }
        ctx.flags[propName].push(result);
        if (hasNext(arg)) {
          parseNext(option2);
        }
      } else {
        setFlagValue(result);
      }
      function hasNext(arg2) {
        if (!option2.args?.length) {
          return false;
        }
        const nextValue = next();
        if (nextValue === void 0) {
          return false;
        }
        if (option2.args.length > 1 && optionArgsIndex >= option2.args.length) {
          return false;
        }
        let nextOption;
        if (!arg2.optional && (!arg2.variadic || !(nextOption = getOption(opts.flags ?? [], nextValue)))) {
          return true;
        }
        if (option2.equalsSign && arg2.optional && !arg2.variadic && typeof currentValue === "undefined") {
          return false;
        }
        if ((arg2.optional || arg2.variadic) && !(nextOption ?? getOption(opts.flags ?? [], nextValue))) {
          return nextValue[0] !== "-" || typeof currentValue !== "undefined" || arg2.type === "number" && !isNaN(Number(nextValue));
        }
        return false;
      }
    }, setFlagValue = function(value) {
      ctx.flags[propName] = value;
      if (ctx.defaults[propName]) {
        delete ctx.defaults[propName];
      }
    };
    let option;
    let current = args[argsIndex];
    let currentValue;
    let negate = false;
    let skipArgument = false;
    if (inLiteral) {
      ctx.literal.push(current);
      continue;
    } else if (current === "--") {
      inLiteral = true;
      continue;
    } else if (ctx.stopEarly || ctx.stopOnUnknown) {
      ctx.unknown.push(current);
      continue;
    }
    const maybeIsFlag = current.length > 1 && current[0] === "-";
    if (!maybeIsFlag) {
      if (opts.stopEarly) {
        ctx.stopEarly = true;
      }
      if (opts.stopEarly || !opts.args?.length) {
        ctx.unknown.push(current);
        continue;
      }
    }
    const maybeIsShort = maybeIsFlag && current[1] !== "-";
    const maybeIsLong = maybeIsShort ? false : maybeIsFlag && current.length > 3 && current[2] !== "-";
    const currentRaw = current;
    let splitCount = 0;
    if (maybeIsShort && current.length > 2 && current[2] !== ".") {
      const flags = splitFlags(current);
      splitCount = flags.length;
      args.splice(argsIndex, 1, ...flags);
      current = args[argsIndex];
    } else if (maybeIsLong && current.startsWith("--no-")) {
      negate = true;
    }
    const equalSignIndex = current.indexOf("=");
    if (equalSignIndex !== -1) {
      currentValue = current.slice(equalSignIndex + 1);
      current = current.slice(0, equalSignIndex);
    }
    if (opts.flags) {
      if (maybeIsFlag) {
        option = getOption(opts.flags, current);
      }
      if (!option) {
        const name = current.replace(/^-+/, "");
        option = matchWildCardOptions(name, opts.flags);
        if (!option) {
          if (opts.stopOnUnknown) {
            ctx.stopOnUnknown = true;
            ctx.unknown.push(args[argsIndex]);
            continue;
          }
          if (opts.args?.length) {
            const argDef = opts.args[argIndex];
            if (argDef) {
              const args2 = ctx.args ??= [];
              if (argDef.optional && currentRaw === "") {
                if (!argDef.variadic) {
                  args2.push(void 0);
                  argIndex++;
                }
                continue;
              }
              if (argDef.list) {
                args2.push(parseListValue(opts, {
                  label: "Argument",
                  name: argDef.name || `arg[${argIndex}]`,
                  type: argDef.type || "string",
                  value: currentRaw,
                  separator: argDef.separator
                }));
              } else {
                args2.push(parseValue(opts, {
                  label: "Argument",
                  name: argDef.name || `arg[${argIndex}]`,
                  type: argDef.type || "string",
                  value: currentRaw
                }));
              }
              if (splitCount > 1) {
                argsIndex += splitCount - 1;
              }
              if (!argDef.variadic) {
                argIndex++;
              } else if (opts.args[argIndex + 1]) {
                throw new UnexpectedArgumentAfterVariadicArgumentError(currentRaw);
              }
              continue;
            }
          }
          if (!maybeIsFlag) {
            throw new TooManyArgumentsError([
              currentRaw
            ]);
          }
          throw new UnknownOptionError(current, opts.flags);
        }
      }
    } else {
      if (opts.args?.length && !maybeIsFlag) {
        const argDef = opts.args[argIndex];
        if (argDef) {
          const posArgs = ctx.args ??= [];
          if (argDef.optional && currentRaw === "") {
            if (!argDef.variadic) {
              posArgs.push(void 0);
              argIndex++;
            }
            continue;
          }
          if (argDef.list) {
            posArgs.push(parseListValue(opts, {
              label: "Argument",
              name: argDef.name || `arg[${argIndex}]`,
              type: argDef.type || "string",
              value: currentRaw,
              separator: argDef.separator
            }));
          } else {
            posArgs.push(parseValue(opts, {
              label: "Argument",
              name: argDef.name || `arg[${argIndex}]`,
              type: argDef.type || "string",
              value: currentRaw
            }));
          }
          if (!argDef.variadic) {
            argIndex++;
          } else if (opts.args[argIndex + 1]) {
            throw new UnexpectedArgumentAfterVariadicArgumentError(currentRaw);
          }
          continue;
        }
      }
      option = {
        name: current.replace(/^-+/, ""),
        optionalValue: true,
        type: "string"
      };
    }
    ctx.parsedFlags.push(args[argsIndex]);
    if (option.standalone) {
      ctx.standalone = option;
    }
    const positiveName = negate ? option.name.replace(/^no-?/, "") : option.name;
    const propName = paramCaseToCamelCase(positiveName);
    if (typeof ctx.flags[propName] !== "undefined") {
      if (!opts.flags?.length) {
        option.collect = true;
      } else if (!option.collect && !ctx.defaults[option.name]) {
        throw new DuplicateOptionError(current);
      }
    }
    if (option.type && !option.args?.length) {
      option.args = [
        {
          name: option.name,
          type: option.type,
          optional: option.optionalValue,
          variadic: option.variadic,
          list: option.list,
          separator: option.separator,
          default: option.default,
          value: option.value
        }
      ];
    }
    if (opts.flags?.length && !option.args?.length && typeof currentValue !== "undefined") {
      throw new UnexpectedOptionValueError(option.name, currentValue);
    }
    let optionArgsIndex = 0;
    let inOptionalArg = false;
    const next = () => currentValue ?? args[argsIndex + 1];
    const previous = ctx.flags[propName];
    parseNext(option);
    if (skipArgument) {
      continue;
    }
    if (typeof ctx.flags[propName] === "undefined") {
      if (option.args?.length && !option.args?.[optionArgsIndex].optional) {
        throw new MissingOptionValueError(option.name);
      } else if (option.default !== void 0 && (option.type || option.value || option.args?.length) || option.args?.some((arg) => arg.default !== void 0 && (arg.type || arg.value))) {
        ctx.flags[propName] = getDefaultValue(option);
      } else {
        setFlagValue(true);
      }
    }
    if (option.args?.some((arg) => arg.value) && (option.args.length > 1 || !option.value)) {
      if (option.args.length === 1) {
        const arg = option.args[0];
        if (typeof arg.value === "function") {
          ctx.flags[propName] = arg.value(ctx.flags[propName]);
        }
      } else {
        for (const [index, arg] of option.args.entries()) {
          if (typeof arg.value === "function") {
            ctx.flags[propName][index] = arg.value(ctx.flags[propName][index]);
          }
        }
      }
    }
    if (option.value) {
      const value = option.value(ctx.flags[propName], previous);
      setFlagValue(value);
    } else if (option.collect) {
      const value = typeof previous !== "undefined" ? Array.isArray(previous) ? previous : [
        previous
      ] : [];
      value.push(ctx.flags[propName]);
      setFlagValue(value);
    }
    optionsMap.set(propName, option);
    opts.option?.(option, ctx.flags[propName]);
  }
  return optionsMap;
}
function parseDottedOptions(ctx) {
  ctx.flags = Object.keys(ctx.flags).reduce((result, key) => {
    if (~key.indexOf(".")) {
      key.split(".").reduce((result2, subKey, index, parts) => {
        if (index === parts.length - 1) {
          result2[subKey] = ctx.flags[key];
        } else {
          result2[subKey] = result2[subKey] ?? {};
        }
        return result2[subKey];
      }, result);
    } else {
      result[key] = ctx.flags[key];
    }
    return result;
  }, {});
}
function splitFlags(flag) {
  flag = flag.slice(1);
  const normalized = [];
  const index = flag.indexOf("=");
  const flags = (index !== -1 ? flag.slice(0, index) : flag).split("");
  if (isNaN(Number(flag[flag.length - 1]))) {
    flags.forEach((val) => normalized.push(`-${val}`));
  } else {
    normalized.push(`-${flags.shift()}`);
    if (flags.length) {
      normalized.push(flags.join(""));
    }
  }
  if (index !== -1) {
    normalized[normalized.length - 1] += flag.slice(index);
  }
  return normalized;
}
function parseValue(opts, options) {
  return opts.parse ? opts.parse(options) : parseDefaultType(options);
}
function parseListValue(opts, options) {
  return options.value.split(options.separator || ",").map((nextValue) => {
    const value = parseValue(opts, {
      ...options,
      value: nextValue
    });
    if (typeof value === "undefined") {
      throw new InvalidOptionValueError(options.name, options.type || "?", nextValue);
    }
    return value;
  });
}
function parseDefaultType({ label, name, type, value }) {
  const parseType = DefaultTypes[type];
  if (!parseType) {
    throw new UnknownTypeError(type, Object.keys(DefaultTypes));
  }
  return parseType({
    label,
    type,
    name,
    value
  });
}
function validateArguments(ctx, opts, options = /* @__PURE__ */ new Map()) {
  if (!opts.args?.length) {
    return;
  }
  const hasDefaults = opts.args.some((arg) => arg.default !== void 0);
  if (!ctx.args?.length && !hasDefaults) {
    const required = opts.args.filter((expectedArg) => !expectedArg.optional).map((expectedArg) => expectedArg.name ?? `arg[${opts.args?.indexOf(expectedArg)}]`);
    if (required.length) {
      const hasStandaloneOption = [
        ...options.keys()
      ].some((name) => opts.flags && getOption(opts.flags, name)?.standalone);
      if (!hasStandaloneOption) {
        throw new MissingArgumentsError(required);
      }
    }
  } else {
    ctx.args ??= [];
    for (const [index, expectedArg] of opts.args?.entries() ?? []) {
      const mapArgValue = (parsed) => {
        return expectedArg.value ? expectedArg.value(parsed) : parsed;
      };
      if (typeof ctx.args[index] === "undefined") {
        if (expectedArg.default !== void 0) {
          const defaultValue = typeof expectedArg.default === "function" ? expectedArg.default() : expectedArg.default;
          const mappedValue2 = mapArgValue(defaultValue);
          if (expectedArg.variadic && Array.isArray(mappedValue2)) {
            ctx.args.splice(index, 0, ...mappedValue2);
            continue;
          } else {
            ctx.args[index] = mappedValue2;
            continue;
          }
        }
        if (expectedArg.optional) {
          continue;
        }
        throw new MissingArgumentError(expectedArg.name ?? `arg[${index}]`);
      }
      let mappedValue;
      if (expectedArg.variadic) {
        mappedValue = mapArgValue(ctx.args.splice(index));
      } else {
        mappedValue = mapArgValue(ctx.args[index]);
      }
      if (typeof mappedValue !== "undefined" || typeof ctx.args[index] !== "undefined") {
        if (expectedArg.variadic && Array.isArray(mappedValue)) {
          ctx.args.splice(index, 0, ...mappedValue);
        } else if (typeof mappedValue !== "undefined") {
          ctx.args[index] = mappedValue;
        }
      }
    }
    if (ctx.unknown.length) {
      throw new TooManyArgumentsError(ctx.unknown);
    }
  }
}

// node_modules/@jsr/std__fmt/colors.js
var { Deno } = globalThis;
var noColor = typeof Deno?.noColor === "boolean" ? Deno.noColor : false;
var enabled = !noColor;
function setColorEnabled(value) {
  if (Deno?.noColor) {
    return;
  }
  enabled = value;
}
function getColorEnabled() {
  return enabled;
}
function code(open, close) {
  return {
    open: `\x1B[${open.join(";")}m`,
    close: `\x1B[${close}m`,
    regexp: new RegExp(`\\x1b\\[${close}m`, "g")
  };
}
function run(str, code2) {
  return enabled ? `${code2.open}${str.replace(code2.regexp, code2.open)}${code2.close}` : str;
}
function bold(str) {
  return run(str, code([
    1
  ], 22));
}
function dim(str) {
  return run(str, code([
    2
  ], 22));
}
function italic(str) {
  return run(str, code([
    3
  ], 23));
}
function red(str) {
  return run(str, code([
    31
  ], 39));
}
function green(str) {
  return run(str, code([
    32
  ], 39));
}
function yellow(str) {
  return run(str, code([
    33
  ], 39));
}
function brightBlue(str) {
  return run(str, code([
    94
  ], 39));
}
function brightMagenta(str) {
  return run(str, code([
    95
  ], 39));
}
var ANSI_REGEXP = new RegExp([
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TXZcf-nq-uy=><~]))"
].join("|"), "g");
function stripAnsiCode(string3) {
  return string3.replace(ANSI_REGEXP, "");
}

// node_modules/@cliffy/command/_utils.js
function getFlag2(name) {
  if (name.startsWith("-")) {
    return name;
  }
  if (name.length > 1) {
    return `--${name}`;
  }
  return `-${name}`;
}
function didYouMean2(message, type, types) {
  const match = types.length ? closestString(type, types) : void 0;
  return match ? `${message} "${match}"?` : "";
}
function didYouMeanCommand(command, commands, excludes = []) {
  const commandNames = commands.map((command2) => command2.getName()).filter((command2) => !excludes.includes(command2));
  return didYouMean2(" Did you mean command", command, commandNames);
}
var ARGUMENT_REGEX = /^[<\[].+[\]>]$/;
var ARGUMENT_DETAILS_REGEX = /[<\[:>\]]/;
function splitArguments(args) {
  const parts = args.trim().split(/[, =] */g);
  const typeParts = [];
  while (parts[parts.length - 1] && ARGUMENT_REGEX.test(parts[parts.length - 1])) {
    typeParts.unshift(parts.pop());
  }
  const typeDefinition = typeParts.join(" ");
  return {
    flags: parts,
    typeDefinition,
    equalsSign: args.includes("=")
  };
}
function parseArgumentsDefinition(argsDefinition, validate = true, all) {
  const argumentDetails = [];
  let hasOptional = false;
  let hasVariadic = false;
  const parts = Array.isArray(argsDefinition) ? argsDefinition : argsDefinition.split(/ +/);
  for (let argDef of parts) {
    if (typeof argDef === "string") {
      argDef = {
        arg: argDef
      };
    }
    if (validate && hasVariadic) {
      throw new UnexpectedArgumentAfterVariadicArgumentError(argDef.arg);
    }
    const parts2 = argDef.arg.split(ARGUMENT_DETAILS_REGEX);
    if (!parts2[1]) {
      if (all) {
        argumentDetails.push(parts2[0]);
      }
      continue;
    }
    const type = parts2[2] || "string";
    const details = {
      description: argDef.description,
      optional: argDef.arg[0] === "[",
      raw: argDef.arg,
      name: parts2[1],
      action: parts2[3] || type,
      variadic: false,
      list: type ? argDef.arg.indexOf(type + "[]") !== -1 : false,
      type
    };
    if (argDef.value !== void 0) {
      details.value = argDef.value;
    }
    if (argDef.default !== void 0) {
      details.default = argDef.default;
    }
    if (argDef.separator !== void 0) {
      details.separator = argDef.separator;
    }
    if (validate && !details.optional && hasOptional) {
      throw new UnexpectedRequiredArgumentError(details.name);
    }
    if (argDef.arg[0] === "[") {
      hasOptional = true;
    }
    if (details.name.length > 3) {
      const istVariadicLeft = details.name.slice(0, 3) === "...";
      const istVariadicRight = details.name.slice(-3) === "...";
      hasVariadic = details.variadic = istVariadicLeft || istVariadicRight;
      if (istVariadicLeft) {
        details.name = details.name.slice(3);
      } else if (istVariadicRight) {
        details.name = details.name.slice(0, -3);
      }
    }
    argumentDetails.push(details);
  }
  return argumentDetails;
}
function dedent(str) {
  const lines = str.split(/\r?\n|\r/g);
  let text = "";
  let indent = 0;
  for (const line of lines) {
    if (text || line.trim()) {
      if (!text) {
        text = line.trimStart();
        indent = line.length - text.length;
      } else {
        text += line.slice(indent);
      }
      text += "\n";
    }
  }
  return text.trimEnd();
}
function getDescription(description, short) {
  return short ? description.trim().split("\n", 1)[0].trim() : dedent(description);
}
function underscoreToCamelCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// node_modules/@cliffy/command/_errors.js
var CommandError = class _CommandError extends Error {
  constructor(message, options) {
    super(message, options);
    Object.setPrototypeOf(this, _CommandError.prototype);
  }
};
var ValidationError2 = class _ValidationError extends CommandError {
  exitCode;
  cmd;
  constructor(message, { exitCode, cause } = {}) {
    super(message, {
      cause
    });
    Object.setPrototypeOf(this, _ValidationError.prototype);
    this.exitCode = exitCode ?? 2;
  }
};
var DuplicateOptionNameError = class _DuplicateOptionNameError extends CommandError {
  constructor(optionName, commandName) {
    super(`An option with name '${bold(getFlag2(optionName))}' is already registered on command '${bold(commandName)}'. If it is intended to override the option, set the '${bold("override")}' option of the '${bold("option")}' method to true.`);
    Object.setPrototypeOf(this, _DuplicateOptionNameError.prototype);
  }
};
var MissingCommandNameError = class _MissingCommandNameError extends CommandError {
  constructor() {
    super("Missing command name.");
    Object.setPrototypeOf(this, _MissingCommandNameError.prototype);
  }
};
var DuplicateCommandNameError = class _DuplicateCommandNameError extends CommandError {
  constructor(name) {
    super(`Duplicate command name "${name}".`);
    Object.setPrototypeOf(this, _DuplicateCommandNameError.prototype);
  }
};
var DuplicateCommandAliasError = class _DuplicateCommandAliasError extends CommandError {
  constructor(alias) {
    super(`Duplicate command alias "${alias}".`);
    Object.setPrototypeOf(this, _DuplicateCommandAliasError.prototype);
  }
};
var CommandNotFoundError = class _CommandNotFoundError extends CommandError {
  constructor(name, commands, excluded) {
    super(`Unknown command "${name}".${didYouMeanCommand(name, commands, excluded)}`);
    Object.setPrototypeOf(this, _CommandNotFoundError.prototype);
  }
};
var DuplicateTypeError = class _DuplicateTypeError extends CommandError {
  constructor(name) {
    super(`Type with name "${name}" already exists.`);
    Object.setPrototypeOf(this, _DuplicateTypeError.prototype);
  }
};
var DuplicateCompletionError = class _DuplicateCompletionError extends CommandError {
  constructor(name) {
    super(`Completion with name "${name}" already exists.`);
    Object.setPrototypeOf(this, _DuplicateCompletionError.prototype);
  }
};
var DuplicateExampleError = class _DuplicateExampleError extends CommandError {
  constructor(name) {
    super(`Example with name "${name}" already exists.`);
    Object.setPrototypeOf(this, _DuplicateExampleError.prototype);
  }
};
var DuplicateEnvVarError = class _DuplicateEnvVarError extends CommandError {
  constructor(name) {
    super(`Environment variable with name "${name}" already exists.`);
    Object.setPrototypeOf(this, _DuplicateEnvVarError.prototype);
  }
};
var MissingRequiredEnvVarError = class _MissingRequiredEnvVarError extends ValidationError2 {
  constructor(envVar) {
    super(`Missing required environment variable "${envVar.names[0]}".`);
    Object.setPrototypeOf(this, _MissingRequiredEnvVarError.prototype);
  }
};
var TooManyEnvVarValuesError = class _TooManyEnvVarValuesError extends CommandError {
  constructor(name) {
    super(`An environment variable can only have one value, but "${name}" has more than one.`);
    Object.setPrototypeOf(this, _TooManyEnvVarValuesError.prototype);
  }
};
var UnexpectedOptionalEnvVarValueError = class _UnexpectedOptionalEnvVarValueError extends CommandError {
  constructor(name) {
    super(`An environment variable cannot have an optional value, but "${name}" is defined as optional.`);
    Object.setPrototypeOf(this, _UnexpectedOptionalEnvVarValueError.prototype);
  }
};
var UnexpectedVariadicEnvVarValueError = class _UnexpectedVariadicEnvVarValueError extends CommandError {
  constructor(name) {
    super(`An environment variable cannot have an variadic value, but "${name}" is defined as variadic.`);
    Object.setPrototypeOf(this, _UnexpectedVariadicEnvVarValueError.prototype);
  }
};
var DefaultCommandNotFoundError = class _DefaultCommandNotFoundError extends CommandError {
  constructor(name, commands) {
    super(`Default command "${name}" not found.${didYouMeanCommand(name, commands)}`);
    Object.setPrototypeOf(this, _DefaultCommandNotFoundError.prototype);
  }
};
var UnknownCommandError = class _UnknownCommandError extends ValidationError2 {
  constructor(name, commands, excluded) {
    super(`Unknown command "${name}".${didYouMeanCommand(name, commands, excluded)}`);
    Object.setPrototypeOf(this, _UnknownCommandError.prototype);
  }
};
var NoArgumentsAllowedError = class _NoArgumentsAllowedError extends ValidationError2 {
  constructor(name) {
    super(`No arguments allowed for command "${name}".`);
    Object.setPrototypeOf(this, _NoArgumentsAllowedError.prototype);
  }
};
var TooManyArgumentsError2 = class _TooManyArgumentsError extends ValidationError2 {
  constructor(args) {
    super(`Too many arguments: ${args.join(" ")}`);
    Object.setPrototypeOf(this, _TooManyArgumentsError.prototype);
  }
};

// node_modules/@jsr/cliffy__internal/runtime/exit.js
function exit(code2) {
  const { Deno: Deno2, process: process2 } = globalThis;
  const exit2 = Deno2?.exit ?? process2?.exit;
  if (exit2) {
    exit2(code2);
  }
  throw new Error("unsupported runtime");
}

// node_modules/@jsr/cliffy__internal/runtime/get_env.js
function getEnv(name) {
  const { Deno: Deno2, process: process2 } = globalThis;
  if (Deno2) {
    return Deno2.env.get(name);
  } else if (process2) {
    return process2.env[name];
  }
  throw new Error("unsupported runtime");
}

// node_modules/@jsr/cliffy__table/border.js
var border = {
  top: "\u2500",
  topMid: "\u252C",
  topLeft: "\u250C",
  topRight: "\u2510",
  bottom: "\u2500",
  bottomMid: "\u2534",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  left: "\u2502",
  leftMid: "\u251C",
  mid: "\u2500",
  midMid: "\u253C",
  right: "\u2502",
  rightMid: "\u2524",
  middle: "\u2502"
};

// node_modules/@jsr/cliffy__table/cell.js
var Cell = class _Cell {
  value;
  options;
  /** Get cell length. */
  get length() {
    return this.toString().length;
  }
  /**
   * Any unterminated ANSI formatting overflowed from previous lines of a
   * multi-line cell.
   */
  get unclosedAnsiRuns() {
    return this.options.unclosedAnsiRuns ?? "";
  }
  set unclosedAnsiRuns(val) {
    this.options.unclosedAnsiRuns = val;
  }
  /**
   * Create a new cell. If value is a cell, the value and all options of the cell
   * will be copied to the new cell.
   *
   * @param value Cell or cell value.
   */
  static from(value) {
    let cell;
    if (value instanceof _Cell) {
      cell = new this(value.getValue());
      cell.options = {
        ...value.options
      };
    } else {
      cell = new this(value);
    }
    return cell;
  }
  /**
   * Cell constructor.
   *
   * @param value Cell value.
   */
  constructor(value) {
    this.value = value;
    this.options = {};
  }
  /** Get cell string value. */
  toString() {
    return this.value.toString();
  }
  /** Get cell value. */
  getValue() {
    return this.value;
  }
  /**
   * Set cell value.
   *
   * @param value Cell or cell value.
   */
  setValue(value) {
    this.value = value;
    return this;
  }
  /**
   * Clone cell with all options.
   *
   * @param value Cell or cell value.
   */
  clone(value) {
    return _Cell.from(value ?? this);
  }
  /**
   * Setter:
   */
  /**
  * Enable/disable cell border.
  *
  * @param enable    Enable/disable cell border.
  * @param override  Override existing value.
  */
  border(enable = true, override = true) {
    if (override || typeof this.options.border === "undefined") {
      this.options.border = enable;
    }
    return this;
  }
  /**
   * Set col span.
   *
   * ```ts
   * import { Cell, Table } from "./mod.ts";
   *
   * new Table()
   *   .body([
   *     [
   *       new Cell("Row 1 & 2 Column 1").rowSpan(2),
   *       "Row 1 Column 2",
   *       "Row 1 Column 3",
   *     ],
   *     [new Cell("Row 2 Column 2 & 3").colSpan(2)],
   *   ])
   *   .border()
   *   .render();
   * ```
   *
   * @param span      Number of cols to span.
   * @param override  Override existing value.
   */
  colSpan(span, override = true) {
    if (override || typeof this.options.colSpan === "undefined") {
      this.options.colSpan = span;
    }
    return this;
  }
  /**
   * Set row span.
   *
   * ```ts
   * import { Cell, Table } from "./mod.ts";
   *
   * new Table()
   *   .body([
   *     [
   *       new Cell("Row 1 & 2 Column 1").rowSpan(2),
   *       "Row 1 Column 2",
   *       "Row 1 Column 3",
   *     ],
   *     [new Cell("Row 2 Column 2 & 3").colSpan(2)],
   *   ])
   *   .border()
   *   .render();
   * ```
   *
   * @param span      Number of rows to span.
   * @param override  Override existing value.
   */
  rowSpan(span, override = true) {
    if (override || typeof this.options.rowSpan === "undefined") {
      this.options.rowSpan = span;
    }
    return this;
  }
  /**
   * Align cell content.
   *
   * @param direction Align direction.
   * @param override  Override existing value.
   */
  align(direction, override = true) {
    if (override || typeof this.options.align === "undefined") {
      this.options.align = direction;
    }
    return this;
  }
  /**
   * Getter:
   */
  /** Check if cell has border. */
  getBorder() {
    return this.options.border === true;
  }
  /** Get col span. */
  getColSpan() {
    return typeof this.options.colSpan === "number" && this.options.colSpan > 0 ? this.options.colSpan : 1;
  }
  /** Get row span. */
  getRowSpan() {
    return typeof this.options.rowSpan === "number" && this.options.rowSpan > 0 ? this.options.rowSpan : 1;
  }
  /** Get row span. */
  getAlign() {
    return this.options.align ?? "left";
  }
};

// node_modules/@jsr/cliffy__table/column.js
var Column = class _Column {
  /**
   * Create a new cell from column options or an existing column.
   * @param options
   */
  static from(options) {
    const opts = options instanceof _Column ? options.opts : options;
    return new _Column().options(opts);
  }
  opts = {};
  /** Set column options. */
  options(options) {
    Object.assign(this.opts, options);
    return this;
  }
  /** Set min column width. */
  minWidth(width) {
    this.opts.minWidth = width;
    return this;
  }
  /** Set max column width. */
  maxWidth(width) {
    this.opts.maxWidth = width;
    return this;
  }
  /** Set column border. */
  border(border2 = true) {
    this.opts.border = border2;
    return this;
  }
  /** Set column padding. */
  padding(padding) {
    this.opts.padding = padding;
    return this;
  }
  /** Set column alignment. */
  align(direction) {
    this.opts.align = direction;
    return this;
  }
  /**
   * Set column flex-shrink weight. Follows CSS flex-shrink semantics: each
   * column's share of the reduction is proportional to `weight × width`, so
   * a wider column or one with a higher weight absorbs more of the overflow.
   * 0 = rigid (never shrinks), 1 = default. See MDN flex-shrink for full detail.
   */
  flexShrink(weight = 1) {
    this.opts.flexShrink = weight;
    return this;
  }
  /**
   * Set column flex-grow weight. Follows CSS flex-grow semantics: available
   * slack is distributed proportionally by weight, so weight 2 receives twice
   * the extra space of weight 1. 0 = no grow.
   * See MDN flex-grow for full detail.
   */
  flexGrow(weight = 1) {
    this.opts.flexGrow = weight;
    return this;
  }
  /**
   * Shorthand to set both flex-grow and flex-shrink to the same value. Follows
   * CSS flex semantics: the column will both expand into and contract out of
   * available space proportionally. 0 = rigid.
   * See MDN flex for full detail.
   */
  flex(weight = 1) {
    this.opts.flexGrow = weight;
    this.opts.flexShrink = weight;
    return this;
  }
  /** Get min column width. */
  getMinWidth() {
    return this.opts.minWidth;
  }
  /** Get max column width. */
  getMaxWidth() {
    return this.opts.maxWidth;
  }
  /** Get column border. */
  getBorder() {
    return this.opts.border;
  }
  /** Get column padding. */
  getPadding() {
    return this.opts.padding;
  }
  /** Get column alignment. */
  getAlign() {
    return this.opts.align;
  }
  /** Get column flex-shrink weight. */
  getFlexShrink() {
    return this.opts.flexShrink;
  }
  /** Get column flex-grow weight. */
  getFlexGrow() {
    return this.opts.flexGrow;
  }
};

// node_modules/@jsr/cliffy__table/unicode_width.js
var tables = null;
var data = {
  "UNICODE_VERSION": "15.0.0",
  "tables": [
    {
      "d": "AAECAwQFBgcICQoLDA0OAw8DDwkQCRESERIA",
      "r": "AQEBAgEBAQEBAQEBAQEBBwEHAVABBwcBBwF4"
    },
    {
      "d": "AAECAwQFBgcGCAYJCgsMDQ4PEAYREhMUBhUWFxgZGhscHR4fICEiIyIkJSYnKCkqJSssLS4vMDEyMzQ1Njc4OToGOzwKBj0GPj9AQUIGQwZEBkVGR0hJSktMTQZOBgoGT1BRUlNUVVZXWFkGWgZbBlxdXl1fYGFiY2RlZmdoBmlqBmsGAQZsBm1uO29wcXI7czt0dXZ3OwY7eHkGent8Bn0Gfn+AgYKDhIWGBoc7iAZdO4kGiosGAXGMBo0GjgaPBpAGkQaSBpMGlJUGlpcGmJmam5ydnp+gLgahLKIGo6SlpganqKmqqwasBq0Grq8GsLGyswa0BrUGtre4Brm6uwZHvAa9vga/wME7wjvDxAbFO8bHO8gGyQbKywbMzQbOBs/Q0QbSBr8GvgbT1AbUBtUG1gbXBtjZ2tsG3N0G3t/g4eLjO+Tl5ufoO+k76gbrBuztOwbu7/AGO+XxCgYKCwZd8g==",
      "r": "AQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECBQEOAQEBAQEBAQEBAwEBAQEBAQEBAQIBAwEIAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBDQEBBQEBAQEBAgEBAwEBAQEBAQEBAQEBbQHaAQEFAQEBBAECAQEBAQEBAQEBAwGuASFkCAELAQEBAQEBAQEHAQMBAQEaAQIBCAEFAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQIBAQEBAQEBAwEDAQEBAQEBAQUBAQEBAQEBBAEBAVIBAdkBARABAQFfARMBAYoBBAEBBQEmAUkBAQcBAQIBHgEBARUBAQEBAQUBAQcBDwEBARoBAgEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQMBBAEBAgEBAQEUfwEBAQIDAXj/AQ=="
    },
    {
      "d": "AFUVAF3Xd3X/93//VXVVV9VX9V91f1/31X93XVXdVdVV9dVV/VVX1X9X/131VfXVVXV3V1VdVV1V1/1dV1X/3VUAVf3/3/9fVf3/3/9fVV1V/11VFQBQVQEAEEEQVQBQVQBAVFUVAFVUVQUAEAAUBFBVFVFVAEBVBQBUVRUAVVFVBRAAAVBVAVVQVQBVBQBAVUVUAQBUUQEAVQVVUVVUAVRVUVUFVUVBVVRBFRRQUVVQUVUBEFRRVQVVBQBRVRQBVFVRVUFVBVVFVVRVUVVUVQRUBQRQVUFVBVVFVVBVBVVQVRVUAVRVUVUFVVFVRVUFRFVRAEBVFQBAVVEAVFUAQFVQVRFRVQEAQAAEVQEAAQBUVUVVAQQAQVVQBVRVAVRVRUFVUVVRVaoAVQFVBVRVBVUFVQVVEABQVUUBAFVRVRUAVUFVUVVAFVRVRVUBVRUUVUUAQEQBAFQVABRVAEBVAFUEQFRFVRUAVVBVBVAQUFVFUBFQVQAFVUAABABUUVVUUFUVANd/X3//BUD3XdV1VQAEAFVXVdX9V1VXVQBUVdVdVdV1VX111VXVV9V//1X/X1VdVf9fVV9VdVdV1VX31dfVXXX9193/d1X/VV9VV3VVX//1VfVVXVVdVdVVdVWlVWlVqVaWVf/f/1X/Vf/1X1Xf/19V9VVf9df1X1X1X1XVVWlVfV31VVpVd1V3VapV33/fVZVVlVX1WVWlVelV+v/v//7/31Xv/6/77/tVWaVVVlVdVWaVmlX1/1WpVVZVlVWVVlVW+V9VFVBVAKqaqlWqWlWqVaoKoKpqqapqgapVqaqpqmqqVapqqv+qVqpqVRVAAFBVBVVQVUUVVUFVVFVQVQBQVRVVBQBQVRUAUFWqVkBVFQVQVVFVAUBBVRVVVFVUVQQUVAVRVVBVRVVRVFFVqlVFVQCqWlUAqmqqaqpVqlZVqmpVAV1VUVVUVQVAVQFBVQBVQBVVQVUAVRVUVQFVBQBUVQVQVVFVAEBVFFRVFVBVFUBBUUVVUVVAVRUAAQBUVRVVUFUFAEBVARRVFVAEVUVVFQBAVVRVBQBUAFRVAAVEVUVVFQBEFQRVBVBVEFRVUFUVAEARVFUVUQAQVQEFEABVFQBBVRVEFVUABVVUVQEAQFUVABRAVRVVAUABVQUAQFBVAEAAEFUFAAUABEFVAUBFEAAQVVARVRVUVVBVBUBVRFVUFQBQVQBUVQBAVRVVFUBVqlRVWlWqVapaVapWVaqpqmmqalVlVWpZVapVqlVBAFUAUABAVRVQVRUAQAEAVQVQVQVUVQBAFQBUVVFVVFUVAAEAVQBAABQAEARAVUVVAFUAQFUAQFVWVZVV/39V/1//X1X/76uq6v9XVWpVqlWqVlVaVapaVapWVamqmqqmqlWqapWqVapWqmqmqpaqWlWVaqpVZVVpVVZVlapVqlpVVmqpVapVlVZVqlZVqlVWVapqqpqqVapWqlZVqpqqWlWlqlWqVlWqVlVRVQD/Xw==",
      "r": "CBcBCAEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQMBAQECAQEBAQEBAQEBAQEBBAEBGAEDAQwBAwEIAQEBAQEBAQgcCAEDAQEBAQEDAQEBDQEDEAELAQEBEQEKAQEBDgEBAgIBAQoBBQQBCAEBAQEBAQEHAQEHBgEWAQIBDQECAgEFAQECAgEKAQ0BAQIKAQ0BDQEBAQEBAQEBAgEHAQ4BAQEBAQQBBgEBDgEBAQEBAQcBAQIBAQEBBAEFAQEBDgEBAQEBAQECAQcBDwECAQwCDQEBAQEBAQECAQgBAQEEAQcBDQEBAQEBAQQBBwERAQEBARYBAQECAQEBGAECAQIBARIBBgEBDQECAQEBAQECAQgBAQEZAQEBAgYBAQEDAQECAQEBAQMBCBgIBwEMAQEGAQcBBwEQAQEBAQEBAgIBCgEBDQEIAQ0BAQEBAQEBBgEBDgEBAQEBAQEBAgEMBwEMAQwBAQEBCQECAwEHAQEBAQ0BAQEBDgIBBgEDAQEBAQEBAQMBAQEBAgEBAQEBAQEBCAEBAgEBAQEBAQkBCAgBAwECAQEBAgEBAQkBAQEBAwECAQMBAQIBBwEFAQEDAQYBAQEBAgEBAQEBAQEBAQECAgEDAQECBAIDAgIBBQEEAQEBAwEPAQEBCyIBCAEJAwQBAQIBAQEBAgECAQEBAQMBAQEBAwEBAQEBAQEBAQgBAQMDAgEBAwEEAQIBAQEBBAEBAQEBAQECAQEBAQEBAQEBAQEHAQQBAwEBAQcBAgUBBgECAQYBAQwBAQEUAQELCAYBFgMFAQYDAQoBAQMBARQBAQkBAQoBBgEVAwsBCgIPAQ0BGQEBAgEHARQBAwIBBgEBAQUBBgQBAgEJAQEBBQECAQMHAQELAQECCQEQAQECAgECAQsBDAEBAQEBCgEBAQsBAQEECQ4BCAQCAQEECAEEAQEFCAEPAQEEAQEPAQgBFAEBAQEBAQEKAQEJAQ8BEAEBEwEBAQIBCwEBDgENAwEKAQEBAQELAQEBAQECAQwBCAEBAQEBDgEDAQwBAQECAQEXAQEBAQEHAgEBBQEIAQEBAQEQAgEBBQEUAQEBAQEbAQEBAQEGARQBAQEBARkBAQEBCQEBAQEQAQIBDwEBARQBAQEBBwEBAQkBAQEBAQECAQEBCwECAQEVAQEBAQQBBQEBAQEOAQEBAQEBEgEBFgEBAgEMAQEBAQ8BAQMBFgEBDgEBBQEPAQETAQECAQMOAgUBCgIBGQEBAQEIAQMBBwEBAwECEwgBAQcLAQUBFwEBAQEDAQEBBwEBBAEBDg0BAQwBAQEDAQQBAQEDBAEBBAEBAQEBEAEPAQgBAQsBAQ4BEQEMAgEBBwEOAQEHAQEBAQQBBAEDCwECAQEBAwEBBggBAgEBAREBBQMKAQEBAwQCEQEBHgEPAQIBAQYEAQYBAwEUAQUMAQEBAQEBAQECAQEBAgEIAwEBBgsBAgEODAMBAgEBCwEBAQEBAwECAQECAQEBBwgPAQ=="
    }
  ]
};
function lookupWidth(cp) {
  if (!tables) {
    tables = data.tables.map(runLengthDecode);
  }
  const t1Offset = tables.at(0)?.[cp >> 13 & 255] ?? 0;
  const t2Offset = tables.at(1)?.[128 * t1Offset + (cp >> 6 & 127)] ?? 0;
  const packedWidths = tables.at(2)?.[16 * t2Offset + (cp >> 2 & 15)] ?? 0;
  const width = packedWidths >> 2 * (cp & 3) & 3;
  return width === 3 ? 1 : width;
}
var cache = /* @__PURE__ */ new Map();
function charWidth(char) {
  const cached = cache.get(char);
  if (cached !== void 0) {
    return cached;
  }
  const codePoint = char.codePointAt(0);
  if (codePoint === void 0) {
    return null;
  }
  let width;
  if (codePoint < 127) {
    width = codePoint >= 32 ? 1 : codePoint === 0 ? 0 : null;
  } else if (codePoint >= 160) {
    width = lookupWidth(codePoint);
  } else {
    width = null;
  }
  cache.set(char, width);
  return width;
}
function unicodeWidth(str) {
  return [
    ...str
  ].map((ch) => charWidth(ch) ?? 0).reduce((a, b) => a + b, 0);
}
function runLengthDecode({ d, r }) {
  const data2 = atob(d);
  const runLengths = atob(r);
  let out = "";
  for (const [i, ch] of [
    ...runLengths
  ].entries()) {
    out += data2.charAt(i).repeat(ch.codePointAt(0) ?? 0);
  }
  return Uint8Array.from([
    ...out
  ].map((x) => x.codePointAt(0) ?? 0));
}

// node_modules/@jsr/cliffy__table/_utils.js
function longest(index, rows, maxWidth) {
  const cellLengths = rows.map((row) => {
    const cell = row[index];
    const cellValue = cell instanceof Cell && cell.getColSpan() > 1 ? "" : cell?.toString() || "";
    return cellValue.split("\n").map((line) => {
      const str = typeof maxWidth === "undefined" ? line : consumeWords(maxWidth, line);
      return strLength(str) || 0;
    });
  }).flat();
  return Math.max(...cellLengths);
}
var strLength = (str) => {
  return unicodeWidth(stripAnsiCode(str));
};
var ansiRegexSource = (
  // deno-lint-ignore no-control-regex
  /\x1b\[(?:(?<_0>0)|(?<_22>1|2|22)|(?<_23>3|23)|(?<_24>4|24)|(?<_27>7|27)|(?<_28>8|28)|(?<_29>9|29)|(?<_39>30|31|32|33|34|35|36|37|38;2;\d+;\d+;\d+|38;5;\d+|39|90|91|92|93|94|95|96|97)|(?<_49>40|41|42|43|44|45|46|47|48;2;\d+;\d+;\d+|48;5;\d+|49|100|101|102|103|104|105|106|107))m/.source
);
function getUnclosedAnsiRuns(text) {
  const tokens = [];
  for (const { groups } of text.matchAll(new RegExp(ansiRegexSource, "g"))) {
    if (!groups) {
      continue;
    }
    const entry = Object.entries(groups).find(([_, val]) => val);
    if (!entry) {
      continue;
    }
    const [_kind, content] = entry;
    tokens.push({
      kind: _kind.slice(1),
      content
    });
  }
  let unclosed = [];
  for (const token of tokens) {
    unclosed = [
      ...unclosed.filter((y) => y.kind !== token.kind),
      token
    ];
  }
  unclosed = unclosed.filter(({ content, kind }) => content !== kind);
  const currentSuffix = unclosed.map(({ kind }) => `\x1B[${kind}m`).reverse().join("");
  const nextPrefix = unclosed.map(({ content }) => `\x1B[${content}m`).join("");
  return {
    /** The suffix to be appended to the text to close all unclosed runs. */
    currentSuffix,
    /**
     * The prefix to be appended to the next segment to continue unclosed
     * runs if the input text forms the first segment of a multi-line string.
     */
    nextPrefix
  };
}

// node_modules/@jsr/cliffy__table/consume_words.js
function consumeWords(length, content) {
  let consumed = "";
  const words = content.split("\n")[0]?.split(/ /g);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (consumed) {
      const nextLength = strLength(word);
      const consumedLength = strLength(consumed);
      if (consumedLength + nextLength >= length) {
        break;
      }
    }
    consumed += (i > 0 ? " " : "") + word;
  }
  return consumed;
}
function consumeChars(length, content) {
  let consumed = "";
  const chars = [
    ...content.split("\n")[0].matchAll(new RegExp(`(?:${ansiRegexSource})+|.`, "gu"))
  ].map(([match]) => match);
  for (const char of chars) {
    if (consumed) {
      const nextLength = strLength(char);
      const consumedLength = strLength(consumed);
      if (consumedLength + nextLength > length) {
        break;
      }
    }
    consumed += char;
  }
  return consumed;
}

// node_modules/@jsr/cliffy__table/row.js
var Row = class _Row extends Array {
  options = {};
  /**
   * Create a new row. If cells is a row, all cells and options of the row will
   * be copied to the new row.
   *
   * @param cells Cells or row.
   */
  static from(cells) {
    const row = new this(...cells);
    if (cells instanceof _Row) {
      row.options = {
        ...cells.options
      };
    }
    return row;
  }
  /** Clone row recursively with all options. */
  clone() {
    const row = new _Row(...this.map((cell) => cell instanceof Cell ? cell.clone() : cell));
    row.options = {
      ...this.options
    };
    return row;
  }
  /**
   * Setter:
   */
  /**
  * Enable/disable cell border.
  *
  * @param enable    Enable/disable cell border.
  * @param override  Override existing value.
  */
  border(enable = true, override = true) {
    if (override || typeof this.options.border === "undefined") {
      this.options.border = enable;
    }
    return this;
  }
  /**
   * Align row content.
   *
   * @param direction Align direction.
   * @param override  Override existing value.
   */
  align(direction, override = true) {
    if (override || typeof this.options.align === "undefined") {
      this.options.align = direction;
    }
    return this;
  }
  /**
   * Getter:
   */
  /** Check if row has border. */
  getBorder() {
    return this.options.border === true;
  }
  /** Check if row or any child cell has border. */
  hasBorder() {
    return this.getBorder() || this.some((cell) => cell instanceof Cell && cell.getBorder());
  }
  /** Get row alignment. */
  getAlign() {
    return this.options.align ?? "left";
  }
};

// node_modules/@jsr/cliffy__table/_layout.js
var sum = (numList) => numList.reduce((a, b) => a + b, 0);
var TableLayout = class {
  table;
  options;
  /**
   * Table layout constructor.
   * @param table   Table instance.
   * @param options Render options.
   */
  constructor(table, options) {
    this.table = table;
    this.options = options;
  }
  /** Generate table string. */
  toString() {
    const opts = this.createLayout();
    return opts.rows.length ? this.renderRows(opts) : "";
  }
  /**
   * Generates table layout including row and col span, converts all none
   * Cell/Row values to Cells and Rows and returns the layout rendering
   * settings.
   */
  createLayout() {
    Object.keys(this.options.chars).forEach((key) => {
      if (typeof this.options.chars[key] !== "string") {
        this.options.chars[key] = "";
      }
    });
    const hasBodyBorder = this.table.getBorder() || this.table.hasBodyBorder();
    const hasHeaderBorder = this.table.hasHeaderBorder();
    const hasBorder = hasHeaderBorder || hasBodyBorder;
    const rows = this.#getRows();
    const columns = Math.max(...rows.map((row) => row.length));
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const length = row.length;
      if (length < columns) {
        const diff = columns - length;
        for (let i = 0; i < diff; i++) {
          row.push(this.createCell(null, row, rowIndex, length + i));
        }
      }
    }
    const { padding, width, minColWidth, maxColWidth } = this.computeColumnDimensions(columns, rows);
    if (isFinite(this.options.maxWidth)) {
      const totalPadding = hasBorder ? sum(padding) * 2 + (columns + 1) : sum(padding.slice(0, -1));
      const maxAllowable = this.options.maxWidth - totalPadding;
      if (sum(width) > maxAllowable) {
        this.applyFlexShrink(width, minColWidth, maxAllowable);
      }
      if (sum(width) < maxAllowable) {
        this.applyFlexGrow(width, maxColWidth, maxAllowable);
      }
    }
    return {
      padding,
      width,
      rows,
      columns,
      hasBorder,
      hasBodyBorder,
      hasHeaderBorder
    };
  }
  computeColumnDimensions(columns, rows) {
    const padding = [];
    const width = [];
    const minColWidth = [];
    const maxColWidth = [];
    for (let colIndex = 0; colIndex < columns; colIndex++) {
      const column = this.options.columns.at(colIndex);
      minColWidth[colIndex] = column?.getMinWidth() ?? (Array.isArray(this.options.minColWidth) ? this.options.minColWidth[colIndex] : this.options.minColWidth) ?? 0;
      maxColWidth[colIndex] = column?.getMaxWidth() ?? (Array.isArray(this.options.maxColWidth) ? this.options.maxColWidth[colIndex] : this.options.maxColWidth) ?? Infinity;
      const colWidth = longest(colIndex, rows, maxColWidth[colIndex]);
      width[colIndex] = Math.min(maxColWidth[colIndex], Math.max(minColWidth[colIndex], colWidth));
      padding[colIndex] = column?.getPadding() ?? (Array.isArray(this.options.padding) ? this.options.padding[colIndex] : this.options.padding) ?? 0;
    }
    return {
      padding,
      width,
      minColWidth,
      maxColWidth
    };
  }
  applyFlexShrink(width, minColWidth, maxAllowable) {
    const shrink = width.map((_w, i) => this.resolveColumnWeight("flexShrink", i));
    let changed = true;
    while (changed) {
      changed = false;
      if (sum(width) <= maxAllowable) {
        break;
      }
      const overflow = sum(width) - maxAllowable;
      const scaledTotal = sum(width.map((w, i) => shrink[i] > 0 && w > minColWidth[i] ? shrink[i] * w : 0));
      if (scaledTotal === 0) {
        break;
      }
      for (let i = 0; i < width.length; i++) {
        if (shrink[i] > 0 && width[i] > minColWidth[i]) {
          const target = Math.max(Math.max(1, minColWidth[i]), Math.floor(width[i] * (1 - overflow * shrink[i] / scaledTotal)));
          if (target !== width[i]) {
            width[i] = target;
            changed = true;
          }
        }
      }
    }
  }
  applyFlexGrow(width, maxColWidth, maxAllowable) {
    const grow = width.map((_w, i) => this.resolveColumnWeight("flexGrow", i));
    let changed = true;
    while (changed) {
      changed = false;
      if (sum(width) >= maxAllowable) {
        break;
      }
      const slack = maxAllowable - sum(width);
      const totalWeight = sum(grow.map((g, i) => width[i] < maxColWidth[i] ? g : 0));
      if (totalWeight === 0) {
        break;
      }
      for (let i = 0; i < width.length; i++) {
        if (grow[i] > 0 && width[i] < maxColWidth[i]) {
          const extra = Math.floor(slack * grow[i] / totalWeight);
          const newWidth = Math.min(maxColWidth[i], width[i] + extra);
          if (newWidth !== width[i]) {
            width[i] = newWidth;
            changed = true;
          }
        }
      }
    }
  }
  resolveColumnWeight(prop, i) {
    const getter = prop === "flexShrink" ? "getFlexShrink" : "getFlexGrow";
    const weight = this.options.columns.at(i)?.[getter]() ?? (Array.isArray(this.options[prop]) ? this.options[prop][i] : this.options[prop]);
    return Number.isFinite(weight) && weight > 0 ? weight : 0;
  }
  #getRows() {
    const header = this.table.getHeader();
    const rows = header ? [
      header,
      ...this.table
    ] : this.table.slice();
    const hasSpan = rows.some((row) => row.some((cell) => cell instanceof Cell && (cell.getColSpan() > 1 || cell.getRowSpan() > 1)));
    if (hasSpan) {
      return this.spanRows(rows);
    }
    return rows.map((row, rowIndex) => {
      const newRow = this.createRow(row);
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        newRow[colIndex] = this.createCell(row[colIndex], newRow, rowIndex, colIndex);
      }
      return newRow;
    });
  }
  /**
   * Fills rows and cols by specified row/col span with a reference of the
   * original cell.
   */
  spanRows(rows) {
    const rowSpan = [];
    let colSpan = 1;
    let rowIndex = -1;
    while (true) {
      rowIndex++;
      if (rowIndex === rows.length && rowSpan.every((span) => span === 1)) {
        break;
      }
      const row = rows[rowIndex] = this.createRow(rows[rowIndex] || []);
      let colIndex = -1;
      while (true) {
        colIndex++;
        if (colIndex === row.length && colIndex === rowSpan.length && colSpan === 1) {
          break;
        }
        if (colSpan > 1) {
          colSpan--;
          rowSpan[colIndex] = rowSpan[colIndex - 1];
          row.splice(colIndex, this.getDeleteCount(rows, rowIndex, colIndex), row[colIndex - 1]);
          continue;
        }
        if (rowSpan[colIndex] > 1) {
          rowSpan[colIndex]--;
          rows[rowIndex].splice(colIndex, this.getDeleteCount(rows, rowIndex, colIndex), rows[rowIndex - 1][colIndex]);
          continue;
        }
        const cell = row[colIndex] = this.createCell(row[colIndex] || null, row, rowIndex, colIndex);
        colSpan = cell.getColSpan();
        rowSpan[colIndex] = cell.getRowSpan();
      }
    }
    return rows;
  }
  getDeleteCount(rows, rowIndex, colIndex) {
    return colIndex <= rows[rowIndex].length - 1 && typeof rows[rowIndex][colIndex] === "undefined" ? 1 : 0;
  }
  /**
   * Create a new row from existing row or cell array.
   * @param row Original row.
   */
  createRow(row) {
    return Row.from(row).border(this.table.getBorder(), false).align(this.table.getAlign(), false);
  }
  /**
   * Create a new cell from existing cell or cell value.
   *
   * @param cell      Original cell.
   * @param row       Parent row.
   * @param rowIndex  The row index of the cell.
   * @param colIndex  The column index of the cell.
   */
  createCell(cell, row, rowIndex, colIndex) {
    const column = this.options.columns.at(colIndex);
    const isHeaderRow = this.isHeaderRow(rowIndex);
    return Cell.from(cell ?? "").border((isHeaderRow ? null : column?.getBorder()) ?? row.getBorder(), false).align((isHeaderRow ? null : column?.getAlign()) ?? row.getAlign(), false);
  }
  isHeaderRow(rowIndex) {
    return rowIndex === 0 && this.table.getHeader() !== void 0;
  }
  /**
   * Render table layout.
   * @param opts Render options.
   */
  renderRows(opts) {
    let result = "";
    const rowSpan = new Array(opts.columns).fill(1);
    for (let rowIndex = 0; rowIndex < opts.rows.length; rowIndex++) {
      result += this.renderRow(rowSpan, rowIndex, opts);
    }
    return result.slice(0, -1);
  }
  /**
   * Render row.
   * @param rowSpan     Current row span.
   * @param rowIndex    Current row index.
   * @param opts        Render options.
   * @param isMultiline Is multiline row.
   */
  renderRow(rowSpan, rowIndex, opts, isMultiline) {
    const row = opts.rows[rowIndex];
    const prevRow = opts.rows[rowIndex - 1];
    const nextRow = opts.rows[rowIndex + 1];
    let result = "";
    let colSpan = 1;
    if (!isMultiline && rowIndex === 0 && row.hasBorder()) {
      result += this.renderBorderRow(void 0, row, rowSpan, opts);
    }
    let isMultilineRow = false;
    result += " ".repeat(this.options.indent || 0);
    for (let colIndex = 0; colIndex < opts.columns; colIndex++) {
      if (colSpan > 1) {
        colSpan--;
        rowSpan[colIndex] = rowSpan[colIndex - 1];
        continue;
      }
      result += this.renderCell(colIndex, row, opts);
      if (rowSpan[colIndex] > 1) {
        if (!isMultiline) {
          rowSpan[colIndex]--;
        }
      } else if (!prevRow || prevRow[colIndex] !== row[colIndex]) {
        rowSpan[colIndex] = row[colIndex].getRowSpan();
      }
      colSpan = row[colIndex].getColSpan();
      if (rowSpan[colIndex] === 1 && row[colIndex].length) {
        isMultilineRow = true;
      }
    }
    if (opts.columns > 0) {
      if (row[opts.columns - 1].getBorder()) {
        result += this.options.chars.right;
      } else if (opts.hasBorder) {
        result += " ";
      }
    }
    result += "\n";
    if (isMultilineRow) {
      return result + this.renderRow(rowSpan, rowIndex, opts, isMultilineRow);
    }
    if (opts.rows.length > 1 && (rowIndex === 0 && opts.hasHeaderBorder || rowIndex < opts.rows.length - 1 && opts.hasBodyBorder)) {
      result += this.renderBorderRow(row, nextRow, rowSpan, opts);
    }
    if (rowIndex === opts.rows.length - 1 && row.hasBorder()) {
      result += this.renderBorderRow(row, void 0, rowSpan, opts);
    }
    return result;
  }
  /**
   * Render cell.
   * @param colIndex  Current col index.
   * @param row       Current row.
   * @param opts      Render options.
   * @param noBorder  Disable border.
   */
  renderCell(colIndex, row, opts, noBorder) {
    let result = "";
    const prevCell = row[colIndex - 1];
    const cell = row[colIndex];
    if (!noBorder) {
      if (colIndex === 0) {
        if (cell.getBorder()) {
          result += this.options.chars.left;
        } else if (opts.hasBorder) {
          result += " ";
        }
      } else {
        if (cell.getBorder() || prevCell?.getBorder()) {
          result += this.options.chars.middle;
        } else if (opts.hasBorder) {
          result += " ";
        }
      }
    }
    let maxLength = opts.width[colIndex];
    const colSpan = cell.getColSpan();
    if (colSpan > 1) {
      for (let o = 1; o < colSpan; o++) {
        maxLength += opts.width[colIndex + o] + opts.padding[colIndex + o];
        if (opts.hasBorder) {
          maxLength += opts.padding[colIndex + o] + 1;
        }
      }
    }
    const { current, next } = this.renderCellValue(cell, maxLength);
    row[colIndex].setValue(next);
    if (opts.hasBorder) {
      result += " ".repeat(opts.padding[colIndex]);
    }
    result += current;
    if (opts.hasBorder || colIndex < opts.columns - 1) {
      result += " ".repeat(opts.padding[colIndex]);
    }
    return result;
  }
  /**
   * Render specified length of cell. Returns the rendered value and a new cell
   * with the rest value.
   * @param cell      Cell to render.
   * @param maxLength Max length of content to render.
   */
  renderCellValue(cell, maxLength) {
    if (maxLength <= 0) {
      return {
        current: "",
        next: ""
      };
    }
    const length = Math.min(maxLength, strLength(cell.toString()));
    let words = consumeWords(length, cell.toString());
    const breakWord = strLength(words) > length;
    if (breakWord) {
      words = consumeChars(length, words);
    }
    const next = cell.toString().slice(words.length + (breakWord ? 0 : 1));
    words = cell.unclosedAnsiRuns + words;
    const { currentSuffix, nextPrefix } = getUnclosedAnsiRuns(words);
    words += currentSuffix;
    cell.unclosedAnsiRuns = nextPrefix;
    const fillLength = maxLength - strLength(words);
    const align = cell.getAlign();
    let current;
    if (fillLength === 0) {
      current = words;
    } else if (align === "left") {
      current = words + " ".repeat(fillLength);
    } else if (align === "center") {
      current = " ".repeat(Math.floor(fillLength / 2)) + words + " ".repeat(Math.ceil(fillLength / 2));
    } else if (align === "right") {
      current = " ".repeat(fillLength) + words;
    } else {
      throw new Error("Unknown direction: " + align);
    }
    return {
      current,
      next
    };
  }
  /**
   * Render border row.
   * @param prevRow Previous row.
   * @param nextRow Next row.
   * @param rowSpan Current row span.
   * @param opts    Render options.
   */
  renderBorderRow(prevRow, nextRow, rowSpan, opts) {
    let result = "";
    let colSpan = 1;
    for (let colIndex = 0; colIndex < opts.columns; colIndex++) {
      if (rowSpan[colIndex] > 1) {
        if (!nextRow) {
          throw new Error("invalid layout");
        }
        if (colSpan > 1) {
          colSpan--;
          continue;
        }
      }
      result += this.renderBorderCell(colIndex, prevRow, nextRow, rowSpan, opts);
      colSpan = nextRow?.[colIndex].getColSpan() ?? 1;
    }
    return result.length ? " ".repeat(this.options.indent) + result + "\n" : "";
  }
  /**
   * Render border cell.
   * @param colIndex  Current index.
   * @param prevRow   Previous row.
   * @param nextRow   Next row.
   * @param rowSpan   Current row span.
   * @param opts      Render options.
   */
  renderBorderCell(colIndex, prevRow, nextRow, rowSpan, opts) {
    const a1 = prevRow?.[colIndex - 1];
    const a2 = nextRow?.[colIndex - 1];
    const b1 = prevRow?.[colIndex];
    const b2 = nextRow?.[colIndex];
    const a1Border = !!a1?.getBorder();
    const a2Border = !!a2?.getBorder();
    const b1Border = !!b1?.getBorder();
    const b2Border = !!b2?.getBorder();
    const hasColSpan = (cell) => (cell?.getColSpan() ?? 1) > 1;
    const hasRowSpan = (cell) => (cell?.getRowSpan() ?? 1) > 1;
    let result = "";
    if (colIndex === 0) {
      if (rowSpan[colIndex] > 1) {
        if (b1Border) {
          result += this.options.chars.left;
        } else {
          result += " ";
        }
      } else if (b1Border && b2Border) {
        result += this.options.chars.leftMid;
      } else if (b1Border) {
        result += this.options.chars.bottomLeft;
      } else if (b2Border) {
        result += this.options.chars.topLeft;
      } else {
        result += " ";
      }
    } else if (colIndex < opts.columns) {
      if (a1Border && b2Border || b1Border && a2Border) {
        const a1ColSpan = hasColSpan(a1);
        const a2ColSpan = hasColSpan(a2);
        const b1ColSpan = hasColSpan(b1);
        const b2ColSpan = hasColSpan(b2);
        const a1RowSpan = hasRowSpan(a1);
        const a2RowSpan = hasRowSpan(a2);
        const b1RowSpan = hasRowSpan(b1);
        const b2RowSpan = hasRowSpan(b2);
        const hasAllBorder = a1Border && b2Border && b1Border && a2Border;
        const hasAllRowSpan = a1RowSpan && b1RowSpan && a2RowSpan && b2RowSpan;
        const hasAllColSpan = a1ColSpan && b1ColSpan && a2ColSpan && b2ColSpan;
        if (hasAllRowSpan && hasAllBorder) {
          result += this.options.chars.middle;
        } else if (hasAllColSpan && hasAllBorder && a1 === b1 && a2 === b2) {
          result += this.options.chars.mid;
        } else if (a1ColSpan && b1ColSpan && a1 === b1) {
          result += this.options.chars.topMid;
        } else if (a2ColSpan && b2ColSpan && a2 === b2) {
          result += this.options.chars.bottomMid;
        } else if (a1RowSpan && a2RowSpan && a1 === a2) {
          result += this.options.chars.leftMid;
        } else if (b1RowSpan && b2RowSpan && b1 === b2) {
          result += this.options.chars.rightMid;
        } else {
          result += this.options.chars.midMid;
        }
      } else if (a1Border && b1Border) {
        if (hasColSpan(a1) && hasColSpan(b1) && a1 === b1) {
          result += this.options.chars.bottom;
        } else {
          result += this.options.chars.bottomMid;
        }
      } else if (b1Border && b2Border) {
        if (rowSpan[colIndex] > 1) {
          result += this.options.chars.left;
        } else {
          result += this.options.chars.leftMid;
        }
      } else if (b2Border && a2Border) {
        if (hasColSpan(a2) && hasColSpan(b2) && a2 === b2) {
          result += this.options.chars.top;
        } else {
          result += this.options.chars.topMid;
        }
      } else if (a1Border && a2Border) {
        if (hasRowSpan(a1) && a1 === a2) {
          result += this.options.chars.right;
        } else {
          result += this.options.chars.rightMid;
        }
      } else if (a1Border) {
        result += this.options.chars.bottomRight;
      } else if (b1Border) {
        result += this.options.chars.bottomLeft;
      } else if (a2Border) {
        result += this.options.chars.topRight;
      } else if (b2Border) {
        result += this.options.chars.topLeft;
      } else {
        result += " ";
      }
    }
    const length = opts.padding[colIndex] + opts.width[colIndex] + opts.padding[colIndex];
    if (rowSpan[colIndex] > 1 && nextRow) {
      result += this.renderCell(colIndex, nextRow, opts, true);
      if (nextRow[colIndex] === nextRow[nextRow.length - 1]) {
        if (b1Border) {
          result += this.options.chars.right;
        } else {
          result += " ";
        }
        return result;
      }
    } else if (b1Border && b2Border) {
      result += this.options.chars.mid.repeat(length);
    } else if (b1Border) {
      result += this.options.chars.bottom.repeat(length);
    } else if (b2Border) {
      result += this.options.chars.top.repeat(length);
    } else {
      result += " ".repeat(length);
    }
    if (colIndex === opts.columns - 1) {
      if (b1Border && b2Border) {
        result += this.options.chars.rightMid;
      } else if (b1Border) {
        result += this.options.chars.bottomRight;
      } else if (b2Border) {
        result += this.options.chars.topRight;
      } else {
        result += " ";
      }
    }
    return result;
  }
};

// node_modules/@jsr/cliffy__table/table.js
var Table = class _Table extends Array {
  static _chars = {
    ...border
  };
  options = {
    indent: 0,
    border: false,
    maxColWidth: Infinity,
    minColWidth: 0,
    padding: 1,
    maxWidth: Infinity,
    flexShrink: 0,
    flexGrow: 0,
    chars: {
      ..._Table._chars
    },
    columns: []
  };
  headerRow;
  /**
   * Create a new table. If rows is a table, all rows and options of the table
   * will be copied to the new table.
   *
   * @param rows An array of rows or a table instance.
   */
  static from(rows) {
    const table = new this(...rows);
    if (rows instanceof _Table) {
      table.options = {
        ...rows.options
      };
      table.headerRow = rows.headerRow ? Row.from(rows.headerRow) : void 0;
    }
    return table;
  }
  /**
   * Create a new table from an array of json objects. An object represents a
   * row and each property a column.
   *
   * @param rows Array of objects.
   */
  static fromJson(rows) {
    return new this().fromJson(rows);
  }
  /**
   * Set global default border characters.
   *
   * @param chars Border options.
   */
  static chars(chars) {
    Object.assign(this._chars, chars);
    return this;
  }
  /**
   * Write table or rows to stdout.
   *
   * @param rows Table or rows.
   */
  static render(rows) {
    _Table.from(rows).render();
  }
  /**
   * Read data from an array of json objects. An object represents a
   * row and each property a column.
   *
   * @param rows Array of objects.
   */
  fromJson(rows) {
    this.header(Object.keys(rows[0]));
    this.body(rows.map((row) => Object.values(row)));
    return this;
  }
  /**
   * Set column options.
   *
   * @param columns An array of columns or column options.
   */
  columns(columns) {
    this.options.columns = columns.map((column) => column instanceof Column ? column : Column.from(column));
    return this;
  }
  /**
   * Set column options by index.
   *
   @param index   The column index.
   @param column  Column or column options.
   */
  column(index, column) {
    if (column instanceof Column) {
      this.options.columns[index] = column;
    } else if (this.options.columns[index]) {
      this.options.columns[index].options(column);
    } else {
      this.options.columns[index] = Column.from(column);
    }
    return this;
  }
  /**
   * Set table header.
   *
   * @param header Header row or cells.
   */
  header(header) {
    this.headerRow = header instanceof Row ? header : Row.from(header);
    return this;
  }
  /**
   * Set table body.
   *
   * @param rows Array of rows.
   */
  body(rows) {
    this.length = 0;
    this.push(...rows);
    return this;
  }
  /** Clone table recursively with header and options. */
  clone() {
    const table = new _Table(...this.map((row) => row instanceof Row ? row.clone() : Row.from(row).clone()));
    table.options = {
      ...this.options
    };
    table.headerRow = this.headerRow?.clone();
    return table;
  }
  /** Generate table string. */
  toString() {
    return new TableLayout(this, this.options).toString();
  }
  /** Write table to stdout. */
  render() {
    console.log(this.toString());
    return this;
  }
  /**
   * Set max column width.
   *
   * @param width     Max column width.
   * @param override  Override existing value.
   */
  maxColWidth(width, override = true) {
    if (override || typeof this.options.maxColWidth === "undefined") {
      this.options.maxColWidth = width;
    }
    return this;
  }
  /**
   * Set min column width.
   *
   * @param width     Min column width.
   * @param override  Override existing value.
   */
  minColWidth(width, override = true) {
    if (override || typeof this.options.minColWidth === "undefined") {
      this.options.minColWidth = width;
    }
    return this;
  }
  /**
   * Set max table width
   *
   * @param width     Max table width.
   * @param override  Override existing value.
   */
  maxWidth(width, override = true) {
    if (override || typeof this.options.maxWidth === "undefined") {
      this.options.maxWidth = width;
    }
    return this;
  }
  /**
   * Set column flex-shrink weight. Follows CSS flex-shrink semantics: each
   * column's share of the reduction is proportional to `weight × width`, so
   * a wider column or one with a higher weight absorbs more of the overflow.
   * 0 = no shrink (default), >= 1 = shrinkable.
   *
   * @param flexShrink  Per-column shrink weight, or a single value for all columns.
   * @param override    Override existing value.
   */
  flexShrink(flexShrink = 1, override = true) {
    if (override || typeof this.options.flexShrink === "undefined") {
      this.options.flexShrink = flexShrink;
    }
    return this;
  }
  /**
   * Set column flex-grow weight. Follows CSS flex-grow semantics: available
   * slack is distributed proportionally by weight, so weight 2 receives twice
   * the extra space of weight 1. 0 = no grow (default), >= 1 = growable.
   *
   * @param flexGrow  Per-column grow weight, or a single value for all columns.
   * @param override  Override existing value.
   */
  flexGrow(flexGrow = 1, override = true) {
    if (override || typeof this.options.flexGrow === "undefined") {
      this.options.flexGrow = flexGrow;
    }
    return this;
  }
  /**
   * Shorthand to set both flex-grow and flex-shrink to the same value.
   * Columns will both expand into and contract out of
   * available space proportionally. 0 = rigid (default), >= 1 = flexible.
   *
   * @param flex      Per-column weight, or a single value for all columns.
   * @param override  Override existing value.
   */
  flex(flex = 1, override = true) {
    return this.flexGrow(flex, override).flexShrink(flex, override);
  }
  /**
   * Set table indentation.
   *
   * @param width     Indent width.
   * @param override  Override existing value.
   */
  indent(width, override = true) {
    if (override || typeof this.options.indent === "undefined") {
      this.options.indent = width;
    }
    return this;
  }
  /**
   * Set cell padding.
   *
   * @param padding   Cell padding.
   * @param override  Override existing value.
   */
  padding(padding, override = true) {
    if (override || typeof this.options.padding === "undefined") {
      this.options.padding = padding;
    }
    return this;
  }
  /**
   * Enable/disable cell border.
   *
   * @param enable    Enable/disable cell border.
   * @param override  Override existing value.
   */
  border(enable = true, override = true) {
    if (override || typeof this.options.border === "undefined") {
      this.options.border = enable;
    }
    return this;
  }
  /**
   * Align table content.
   *
   * @param direction Align direction.
   * @param override  Override existing value.
   */
  align(direction, override = true) {
    if (override || typeof this.options.align === "undefined") {
      this.options.align = direction;
    }
    return this;
  }
  /**
   * Set border characters.
   *
   * @param chars Border options.
   */
  chars(chars) {
    Object.assign(this.options.chars, chars);
    return this;
  }
  /** Get table header. */
  getHeader() {
    return this.headerRow;
  }
  /** Get table body. */
  getBody() {
    return [
      ...this
    ];
  }
  /** Get max column width. */
  getMaxColWidth() {
    return this.options.maxColWidth;
  }
  /** Get min column width. */
  getMinColWidth() {
    return this.options.minColWidth;
  }
  /** Get table indentation. */
  getIndent() {
    return this.options.indent;
  }
  /** Get cell padding. */
  getPadding() {
    return this.options.padding;
  }
  /** Check if table has border. */
  getBorder() {
    return this.options.border === true;
  }
  /** Check if header row has border. */
  hasHeaderBorder() {
    const hasBorder = this.headerRow?.hasBorder();
    return hasBorder === true || this.getBorder() && hasBorder !== false;
  }
  /** Check if table bordy has border. */
  hasBodyBorder() {
    return this.getBorder() || this.options.columns.some((column) => column.getBorder()) || this.some((row) => row instanceof Row ? row.hasBorder() : row.some((cell) => cell instanceof Cell ? cell.getBorder() : false));
  }
  /** Check if table header or body has border. */
  hasBorder() {
    return this.hasHeaderBorder() || this.hasBodyBorder();
  }
  /** Get table alignment. */
  getAlign() {
    return this.options.align ?? "left";
  }
  /** Get columns. */
  getColumns() {
    return this.options.columns;
  }
  /** Get column by column index. */
  getColumn(index) {
    return this.options.columns[index] ??= new Column();
  }
};

// node_modules/@jsr/cliffy__internal/runtime/get_columns.js
function getColumns() {
  try {
    const { Deno: Deno2, process: process2 } = globalThis;
    if (Deno2) {
      const cols = Deno2.consoleSize().columns;
      return cols && cols > 0 ? cols : null;
    } else if (process2) {
      const cols = process2.stdout.columns;
      return cols && cols > 0 ? cols : null;
    }
  } catch (_error) {
    return null;
  }
  throw new Error("unsupported runtime");
}

// node_modules/@jsr/cliffy__internal/runtime/inspect.js
function inspect(value, colors) {
  const { Deno: Deno2 } = globalThis;
  return Deno2?.inspect(value, {
    depth: 1,
    colors,
    trailingComma: false
  }) ?? JSON.stringify(value, null, 2);
}

// node_modules/@cliffy/command/type.js
var Type = class {
};

// node_modules/@cliffy/command/help/_help_generator.js
var HelpGenerator = class _HelpGenerator {
  cmd;
  indent;
  options;
  /** Generate help text for given command. */
  static generate(cmd, options) {
    return new _HelpGenerator(cmd, options).generate();
  }
  constructor(cmd, options = {}) {
    this.cmd = cmd;
    this.indent = 2;
    this.options = {
      types: false,
      hints: true,
      colors: true,
      long: false,
      width: getColumns() ?? 150,
      maxWidth: Infinity,
      ...options
    };
    this.options.width = Math.min(this.options.width, this.options.maxWidth);
  }
  generate() {
    const areColorsEnabled = getColorEnabled();
    setColorEnabled(this.options.colors);
    const result = this.generateHeader() + this.generateMeta() + this.generateDescription() + this.generateArguments() + this.generateOptions() + this.generateCommands() + this.generateEnvironmentVariables() + this.generateExamples();
    setColorEnabled(areColorsEnabled);
    return result;
  }
  generateHeader() {
    const usage = this.cmd.getUsage();
    const rows = [
      [
        bold("Usage:"),
        brightMagenta(this.cmd.getPath() + (usage ? " " + highlightArguments(usage, this.options.types) : ""))
      ]
    ];
    const version = this.cmd.getVersion();
    if (version) {
      rows.push([
        bold("Version:"),
        yellow(`${this.cmd.getVersion()}`)
      ]);
    }
    return "\n" + Table.from(rows).padding(1).toString() + "\n";
  }
  generateMeta() {
    const meta = Object.entries(this.cmd.getMeta());
    if (!meta.length) {
      return "";
    }
    const rows = [];
    for (const [name, value] of meta) {
      rows.push([
        bold(`${name}: `) + value
      ]);
    }
    return "\n" + Table.from(rows).padding(1).toString() + "\n";
  }
  generateDescription() {
    if (!this.cmd.getDescription()) {
      return "";
    }
    return this.label("Description") + Table.from([
      [
        dedent(this.cmd.getDescription())
      ]
    ]).indent(this.indent).maxColWidth(this.options.width - this.indent).padding(1).toString() + "\n";
  }
  generateArguments() {
    const args = this.cmd.getArguments();
    if (!args.length || !args.find((arg) => arg.description)) {
      return "";
    }
    return this.label("Arguments") + Table.from([
      ...args.filter((arg) => arg.description).map((argument) => [
        highlightArguments(argument.raw || "", this.options.types),
        red(bold("-")),
        getDescription(argument.description ?? "", !this.options.long),
        this.generateArgumentHints(argument)
      ])
    ]).padding([
      2,
      1,
      2
    ]).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
      0,
      0,
      1,
      1
    ]).toString() + "\n";
  }
  generateOptions() {
    const options = this.cmd.getOptions(false);
    if (!options.length) {
      return "";
    }
    let groups = [];
    const hasGroups = options.some((option) => option.groupName);
    if (hasGroups) {
      for (const option of options) {
        let group = groups.find((group2) => group2.name === option.groupName);
        if (!group) {
          group = {
            name: option.groupName,
            options: []
          };
          groups.push(group);
        }
        group.options.push(option);
      }
    } else {
      groups = [
        {
          name: "Options",
          options
        }
      ];
    }
    let result = "";
    for (const group of groups) {
      result += this.generateOptionGroup(group);
    }
    return result;
  }
  generateOptionGroup(group) {
    if (!group.options.length) {
      return "";
    }
    const hasTypeDefinitions = !!group.options.find((option) => !!option.typeDefinition);
    if (hasTypeDefinitions) {
      return this.label(group.name ?? "Options") + Table.from([
        ...group.options.map((option) => [
          option.flags.map((flag) => brightBlue(flag)).join(", "),
          highlightArguments(option.typeDefinition || "", this.options.types),
          red(bold("-")),
          getDescription(option.description, !this.options.long),
          this.generateOptionHints(option)
        ])
      ]).padding([
        2,
        2,
        1,
        2
      ]).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
        0,
        0,
        0,
        1,
        1
      ]).toString() + "\n";
    }
    return this.label(group.name ?? "Options") + Table.from([
      ...group.options.map((option) => [
        option.flags.map((flag) => brightBlue(flag)).join(", "),
        red(bold("-")),
        getDescription(option.description, !this.options.long),
        this.generateOptionHints(option)
      ])
    ]).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
      0,
      0,
      1,
      1
    ]).padding([
      2,
      1,
      2
    ]).toString() + "\n";
  }
  generateCommands() {
    const commands = this.cmd.getCommands(false);
    if (!commands.length) {
      return "";
    }
    const hasTypeDefinitions = !!commands.find((command) => !!command.getArgsDefinition());
    if (hasTypeDefinitions) {
      return this.label("Commands") + Table.from([
        ...commands.map((command) => [
          [
            command.getName(),
            ...command.getAliases()
          ].map((name) => brightBlue(name)).join(", "),
          highlightArguments(command.getArgsDefinition() || "", this.options.types),
          red(bold("-")),
          command.getShortDescription()
        ])
      ]).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
        0,
        0,
        0,
        1
      ]).padding([
        2,
        2,
        1,
        2
      ]).toString() + "\n";
    }
    return this.label("Commands") + Table.from([
      ...commands.map((command) => [
        [
          command.getName(),
          ...command.getAliases()
        ].map((name) => brightBlue(name)).join(", "),
        red(bold("-")),
        command.getShortDescription()
      ])
    ]).maxWidth(this.options.width - this.indent).flexShrink([
      0,
      0,
      1
    ]).padding([
      2,
      1,
      2
    ]).indent(this.indent).toString() + "\n";
  }
  generateEnvironmentVariables() {
    const envVars = this.cmd.getEnvVars(false);
    if (!envVars.length) {
      return "";
    }
    return this.label("Environment variables") + Table.from([
      ...envVars.map((envVar) => [
        envVar.names.map((name) => brightBlue(name)).join(", "),
        highlightArgumentDetails(envVar.details, this.options.types),
        red(bold("-")),
        this.options.long ? dedent(envVar.description) : envVar.description.trim().split("\n", 1)[0],
        envVar.required ? `(${yellow(`required`)})` : ""
      ])
    ]).padding([
      2,
      2,
      1,
      2
    ]).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
      0,
      0,
      0,
      1,
      1
    ]).toString() + "\n";
  }
  generateExamples() {
    const examples = this.cmd.getExamples();
    if (!examples.length) {
      return "";
    }
    return this.label("Examples") + Table.from(examples.map((example) => [
      dim(bold(example.name)),
      dedent(example.description)
    ])).padding(1).indent(this.indent).maxWidth(this.options.width - this.indent).flexShrink([
      0,
      1
    ]).toString() + "\n";
  }
  generateOptionHints(option) {
    if (!this.options.hints) {
      return "";
    }
    const hints = [];
    option.required && hints.push(yellow(`required`));
    const type = this.cmd.getType(option.args[0]?.type)?.handler;
    if (typeof option.default !== "undefined" || typeof option.defaultText !== "undefined") {
      const defaultValue = typeof option.default === "function" ? option.default() : option.default;
      const defaultText = typeof option.defaultText === "function" ? option.defaultText(defaultValue) : typeof option.defaultText !== "undefined" ? option.defaultText : type instanceof Type && type.defaultText ? type.defaultText() : defaultValue;
      if (typeof defaultText !== "undefined") {
        hints.push(bold(`Default: `) + inspect(defaultText, this.options.colors));
      }
    }
    option.depends?.length && hints.push(yellow(bold(`Depends: `)) + italic(option.depends.map(getFlag2).join(", ")));
    option.conflicts?.length && hints.push(red(bold(`Conflicts: `)) + italic(option.conflicts.map(getFlag2).join(", ")));
    return this.generateHints(type, hints);
  }
  generateArgumentHints(option) {
    if (!this.options.hints) {
      return "";
    }
    const hints = [];
    !option.optional && hints.push(yellow(`required`));
    const type = this.cmd.getType(option.type)?.handler;
    return this.generateHints(type, hints);
  }
  generateHints(type, hints) {
    if (type instanceof Type) {
      const possibleValues = type.values?.(this.cmd, this.cmd.getParent());
      if (possibleValues?.length) {
        hints.push(bold(`Values: `) + possibleValues.map((value) => inspect(value, this.options.colors)).join(", "));
      }
    }
    if (hints.length) {
      return `(${hints.join(", ")})`;
    }
    return "";
  }
  label(label) {
    return "\n" + bold(`${label}:`) + "\n\n";
  }
};
function highlightArguments(argsDefinition, types = true) {
  if (!argsDefinition) {
    return "";
  }
  return parseArgumentsDefinition(argsDefinition, false, true).map((arg) => typeof arg === "string" ? arg : highlightArgumentDetails(arg, types)).join(" ");
}
function highlightArgumentDetails(arg, types = true) {
  let str = "";
  str += yellow(arg.optional ? "[" : "<");
  let name = "";
  name += arg.name;
  if (arg.variadic) {
    name += "...";
  }
  name = brightMagenta(name);
  str += name;
  if (types) {
    str += yellow(":");
    str += red(arg.type);
    if (arg.list) {
      str += green("[]");
    }
  }
  str += yellow(arg.optional ? "]" : ">");
  return str;
}

// node_modules/@cliffy/command/types/boolean.js
var BooleanType = class extends Type {
  /** Parse boolean type. */
  parse(type) {
    return boolean(type);
  }
  /** Complete boolean type. */
  complete() {
    return [
      "true",
      "false"
    ];
  }
};

// node_modules/@cliffy/command/types/string.js
var StringType = class extends Type {
  /** Complete string type. */
  parse(type) {
    return string(type);
  }
};

// node_modules/@cliffy/command/types/file.js
var FileType = class extends StringType {
  constructor() {
    super();
  }
};

// node_modules/@cliffy/command/types/integer.js
var IntegerType = class extends Type {
  /** Parse integer type. */
  parse(type) {
    return integer(type);
  }
};

// node_modules/@cliffy/command/types/number.js
var NumberType = class extends Type {
  /** Parse number type. */
  parse(type) {
    return number(type);
  }
};

// node_modules/@cliffy/command/types/secret.js
var SecretType = class extends StringType {
  defaultText() {
    return "******";
  }
};

// node_modules/@cliffy/command/upgrade/_check_version.js
async function checkVersion(cmd) {
  const mainCommand = cmd.getMainCommand();
  const upgradeCommand = mainCommand.getCommand("upgrade");
  if (!isUpgradeCommand(upgradeCommand)) {
    return;
  }
  if (!await upgradeCommand.hasRequiredPermissions()) {
    return;
  }
  const latestVersion = await upgradeCommand.getLatestVersion();
  const currentVersion = mainCommand.getVersion();
  if (!currentVersion || currentVersion === latestVersion) {
    return;
  }
  const versionHelpText = `(New version available: ${latestVersion}. Run '${mainCommand.getName()} upgrade' to upgrade to the latest version!)`;
  mainCommand.version(`${currentVersion}  ${bold(yellow(versionHelpText))}`);
}
function isUpgradeCommand(command) {
  return command instanceof Command && "getLatestVersion" in command && "hasRequiredPermissions" in command;
}

// node_modules/@cliffy/command/command.js
var Command = class _Command {
  cmd = this;
  parent;
  props = {
    rawArgs: [],
    literalArgs: [],
    args: []
  };
  settings = {
    name: "COMMAND",
    description: "",
    examples: [],
    aliases: [],
    meta: {},
    commands: /* @__PURE__ */ new Map()
  };
  builder = {
    groupName: null,
    types: /* @__PURE__ */ new Map(),
    options: [],
    envVars: [],
    completions: /* @__PURE__ */ new Map()
  };
  versionOption(flags, desc, opts) {
    this.settings.versionOptions = flags === false ? flags : {
      flags,
      desc,
      opts: typeof opts === "function" ? {
        action: opts
      } : opts
    };
    return this;
  }
  helpOption(flags, desc, opts) {
    this.settings.helpOptions = flags === false ? flags : {
      flags,
      desc,
      opts: typeof opts === "function" ? {
        action: opts
      } : opts
    };
    return this;
  }
  /**
   * Add new sub-command.
   * @param nameAndArguments  Command definition. E.g: `my-command <input-file:string> <output-file:string>`
   * @param cmdOrDescription  The description of the new child command.
   * @param options           Sub-command options.
   */
  command(nameAndArguments, cmdOrDescription, { override } = {}) {
    this.reset();
    const result = splitArguments(nameAndArguments);
    const name = result.flags.shift();
    const aliases = result.flags;
    if (!name) {
      throw new MissingCommandNameError();
    }
    if (this.getBaseCommand(name, true)) {
      if (!override) {
        throw new DuplicateCommandNameError(name);
      }
      this.removeCommand(name);
    }
    let description;
    let cmd;
    if (typeof cmdOrDescription === "string") {
      description = cmdOrDescription;
    }
    if (cmdOrDescription instanceof _Command) {
      cmd = cmdOrDescription.reset();
    } else {
      cmd = new _Command();
    }
    cmd.settings.name = name;
    cmd.parent = this;
    if (description) {
      cmd.description(description);
    }
    if (result.typeDefinition) {
      cmd.arguments(result.typeDefinition);
    }
    aliases.forEach((alias) => cmd.alias(alias));
    this.settings.commands.set(name, cmd);
    this.select(name);
    return this;
  }
  /**
   * Add new command alias.
   *
   * @param alias Tha name of the alias.
   */
  alias(alias) {
    if (this.cmd.settings.name === alias || this.cmd.settings.aliases.includes(alias)) {
      throw new DuplicateCommandAliasError(alias);
    }
    this.cmd.settings.aliases.push(alias);
    return this;
  }
  /** Reset internal command reference to main command. */
  reset() {
    this.builder.groupName = null;
    this.cmd = this;
    return this;
  }
  /**
   * Set internal command pointer to child command with given name.
   * @param name The name of the command to select.
   */
  select(name) {
    const cmd = this.getBaseCommand(name, true);
    if (!cmd) {
      throw new CommandNotFoundError(name, this.getBaseCommands(true));
    }
    this.cmd = cmd;
    return this;
  }
  /*****************************************************************************
   **** SUB HANDLER ************************************************************
   *****************************************************************************/
  /**
  * Set command name.
  *
  * This method is usually used to set the command name for the main command.
  * The name should match the name of your program. It is displayed in the auto
  * generated help and used for shell completions by default.
  *
  * When used on child command, the name will be overridden by the command name
  * passed to the parent command when the command is registered with the
  * {@linkcode Command.command}.
  *
  * @param name The name for the command.
  */
  name(name) {
    this.cmd.settings.name = name;
    return this;
  }
  /**
   * Set command version.
   *
   * Set the version of your cli. The version is displayed in the auto generated
   * help and the output from the [version](./help.md#version-option) option.
   *
   * @param version Semantic version string string or method that returns the version string.
   */
  version(version) {
    if (typeof version === "string") {
      this.cmd.settings.version = () => version;
    } else if (typeof version === "function") {
      this.cmd.settings.version = version;
    }
    return this;
  }
  /**
   * Add meta data. Will be displayed in the auto generated help and in the
   * output of the long version.
   *
   * @param name  The name/label of the metadata.
   * @param value The value of the metadata.
   */
  meta(name, value) {
    this.cmd.settings.meta[name] = value;
    return this;
  }
  getMeta(name) {
    return typeof name === "undefined" ? this.settings.meta : this.settings.meta[name];
  }
  /**
   * Set help options or define a custom help handler or help string.
   *
   * @param help Options for the build-in help generator or a custom help string
   * or function that generates the help string. If the help is a function, it
   * receives the command instance and the help options as parameters and should
   * return the help string. If the help is a string, it is returned as is when
   * the help is called.
   * @param customHelpOptions Custom help options. If the first parameter is an
   * object, it is treated as custom help options and the default help generator
   * will be used to generate the help text based on these options.
   *
   * @example Help options
   *
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * await new Command()
   *   .name("demo")
   *   .help({ auto: true })
   *   .parse();
   * ```
   *
   * @example Custom help string
   *
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * await new Command()
   *   .name("demo")
   *   .help("This is a custom help string.")
   *   .parse();
   * ```
   *
   * @example Custom help handler
   *
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * await new Command()
   *   .name("demo")
   *   .help((cmd) => {
   *     return `This is a custom help string for command ${cmd.getName()}.`;
   *   })
   *   .parse();
   * ```
   *
   * @example Help help handler with options
   *
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * await new Command()
   *   .name("demo")
   *   .help(
   *     (cmd, options) => {
   *       return `This is a custom help string for command ${cmd.getName()} with options: ${JSON.stringify(options)}.`;
   *     },
   *     { auto: true },
   *   )
   *   .parse();
   * ```
   */
  help(help, customHelpOptions) {
    if (typeof help === "string") {
      this.cmd.settings.help = () => help;
    } else if (typeof help === "function") {
      this.cmd.settings.help = help;
    } else {
      customHelpOptions = help;
      this.cmd.settings.help = (cmd, options) => HelpGenerator.generate(cmd, {
        ...help,
        ...options
      });
    }
    this.cmd.settings.autoHelp = customHelpOptions?.auto;
    return this;
  }
  /**
   * Set the command description.
   *
   * The description will be displayed in the auto generated help. If the help
   * option is called with the short flag `-h`, only the first line is
   * displayed. If called with the long name `--help`, the full description is
   * displayed.
   *
   * For better multiline formatting, unnecessary indentations and empty leading
   * and trailing lines will be automatically removed.
   *
   * @example Multiline formatting
   *
   * For example, following description:
   *
   * ```ts
   * import { Command } from "https://deno.land/x/cliffy/command/mod.ts";
   *
   * new Command()
   *   .description(`
   *     This is a multiline description.
   *       The indentation of this line will be preserved.
   *   `);
   * ```
   *
   * is formatted as follows:
   *
   * ```console
   * This is a multiline description.
   *   The indentation of this line will be preserved.
   * ```
   *
   * @param description The command description.
   */
  description(description) {
    this.cmd.settings.description = description;
    return this;
  }
  /**
   * Set the command usage. Defaults to arguments.
   *
   * With the `.usage()` method you can override the usage text that is
   * displayed at the top of the auto generated help. By default the command
   * arguments are used. The usage is always prefixed with the command name.
   *
   * @example Set custom usage
   *
   * ```ts
   * import { Command } from "https://deno.land/x/cliffy/command/mod.ts";
   *
   * await new Command()
   *   .name("script-runner")
   *   .description("Simple script runner.")
   *   .usage("[options] [script] [script options]")
   *   // ...
   *   .parse(Deno.args);
   * ```
   *
   * @param usage The command usage.
   */
  usage(usage) {
    this.cmd.settings.usage = usage;
    return this;
  }
  /** Hide command from help, completions, etc. */
  hidden() {
    this.cmd.settings.isHidden = true;
    return this;
  }
  /** Make command globally available. */
  global() {
    this.cmd.settings.isGlobal = true;
    return this;
  }
  /**
   * Set command arguments.
   *
   * You can use the {@linkcode Command.arguments} method to specify the
   * arguments for the command.
   *
   * This method will override any previously defined arguments.
   *
   * Angled brackets (e.g. `<required>`) indicate required input and
   * square brackets (e.g. `[optional]`) indicate optional input. A required
   * input cannot be defined after an optional input.
   *
   * Arguments can be also defined with the {@linkcode Command.command} method.
   *
   * Optionally you can define [types](./types.md) and
   * [completions](./shell_completions.md) for your arguments after the argument
   * name separated by colon. If no type is specified the type defaults to
   * `string`.
   *
   * @example Define arguments
   *
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * const cmd = new Command()
   *   .name("example")
   *   .arguments("<input-file:string> [output-file:string] [...tags:string]", [
   *     "The input file.",
   *     "The output file.",
   *     "Tags for the file."
   *   ]);
   *
   * // Parsing arguments
   * const { args } = await cmd.parse(["input.txt", "result.txt", "tag1", "tag2"]);
   *
   * console.log(args); // Output: ['input.txt', 'result.txt', 'tag1', 'tag2']
   * ```
   *
   * @example Use custom types in arguments
   *
   * ```typescript
   * import { Command, EnumType } from "@cliffy/command";
   *
   * await new Command()
   *   .type("color", new EnumType(["red", "blue"]))
   *   .arguments("<color:color>")
   *   .action((_, color: "red" | "blue") => {
   *     console.log("color:", color);
   *   })
   *   .parse(Deno.args);
   * ```
   *
   * @example Variadic arguments
   *
   * The last argument of a command can be variadic. To make an argument
   * variadic you can append or prepend `...` to the argument name (`<...NAME>`
   * or `<NAME...>`).
   *
   * Required rest arguments `<...args>` requires at least one argument, optional
   * rest args `[...args]` are completely optional.
   *
   * ```typescript
   * import { Command } from "https://deno.land/x/cliffy/command/mod.ts";
   *
   * await new Command()
   *   .description("Remove directories.")
   *   .arguments("<dirs...>")
   *   .action((_, ...dirs: Array<string>) => {
   *     for (const dir of dirs) {
   *       console.log("rmdir %s", dir);
   *     }
   *   })
   *   .parse(Deno.args);
   * ```
   *
   * ```console
   * $ deno run example.ts dir1 dir2 dir3
   * rmdir dir1
   * rmdir dir2
   * rmdir dir3
   * ```
   *
   * @param args         The arguments definition string.
   * @param descriptions The argument descriptions.
   * @returns            The command instance.
   */
  arguments(args, descriptions) {
    this.cmd.settings.arguments = args.split(" ").map((arg, index) => ({
      arg,
      description: descriptions?.[index]
    }));
    return this;
  }
  /**
   * Add a new command argument.
   *
   * - When called multiple times, arguments are appended in the order of calls.
   * - When called after `arguments()`, the new argument is appended after the previously
   *   defined arguments.
   * - When called before `arguments()`, the new argument is overwritten by the later
   *   defined arguments.
   *
   * @example
   * ```ts
   * import { Command } from "@cliffy/command";
   *
   * const cmd = new Command()
   *   .name("example")
   *   .argument("<input-file:string>", "The input file.")
   *   .argument("[output-file:string]", "The output file.", { default: "out.txt" })
   *   .argument("[...tags:string]", "Tags for the file.");
   *
   * // Parsing arguments
   * const { args } = await cmd.parse(["input.txt", "result.txt", "tag1", "tag2"]);
   *
   * console.log(args); // Output: ['input.txt', 'result.txt', 'tag1', 'tag2']
   * ```
   *
   * @param arg         The argument definition. E.g: `<input-file:string>`
   * @param description The argument description.
   * @param opts        Argument options.
   * @returns           The command instance.
   */
  argument(arg, description, opts) {
    this.cmd.settings.arguments ??= [];
    this.cmd.settings.arguments.push({
      arg,
      description,
      ...opts
    });
    return this;
  }
  /**
   * Set command callback method.
   *
   * @param fn Command action handler.
   */
  action(fn) {
    this.cmd.settings.actionHandler = fn;
    return this;
  }
  /**
   * Set command callback method.
   *
   * @param fn Command action handler.
   */
  globalAction(fn) {
    this.cmd.settings.globalActionHandler = fn;
    return this;
  }
  /**
   * Don't throw an error if the command was called without arguments.
   *
   * @param allowEmpty Enable/disable allow empty.
   */
  allowEmpty(allowEmpty) {
    this.cmd.settings.allowEmpty = allowEmpty !== false;
    return this;
  }
  /**
   * Enable stop early. If enabled, all arguments starting from the first non
   * option argument will be passed as arguments with type string to the command
   * action handler.
   *
   * For example:
   *     `command --debug-level warning server --port 80`
   *
   * Will result in:
   *     - options: `{ debugLevel: 'warning' }`
   *     - args: `['server', '--port', '80']`
   *
   * @param stopEarly Enable/disable stop early.
   */
  stopEarly(stopEarly = true) {
    this.cmd.settings.stopEarly = stopEarly;
    return this;
  }
  /**
   * Disable parsing arguments. If enabled the raw arguments will be passed to
   * the action handler. This has no effect for parent or child commands. Only
   * for the command on which this method was called.
   *
   * @param useRawArgs Enable/disable raw arguments.
   */
  useRawArgs(useRawArgs = true) {
    this.cmd.settings.useRawArgs = useRawArgs;
    return this;
  }
  /**
   * Set default command.
   *
   * The default command is executed when the command was called without any
   * additional arguments.
   *
   * @param name Name of the default command.
   */
  default(name) {
    this.cmd.settings.defaultCommand = name;
    return this;
  }
  globalType(name, handler, options) {
    return this.type(name, handler, {
      ...options,
      global: true
    });
  }
  /**
   * Register custom type.
   *
   * @param name    The name of the type.
   * @param handler The callback method to parse the type.
   * @param options Type options.
   */
  type(name, handler, options) {
    if (this.cmd.builder.types.get(name) && !options?.override) {
      throw new DuplicateTypeError(name);
    }
    this.cmd.builder.types.set(name, {
      ...options,
      name,
      handler
    });
    if (handler instanceof Type && (typeof handler.complete !== "undefined" || typeof handler.values !== "undefined")) {
      const completeHandler = (cmd, parent) => handler.complete?.(cmd, parent) || [];
      this.complete(name, completeHandler, options);
    }
    return this;
  }
  /**
   * Register global complete handler.
   *
   * @param name      The name of the completion.
   * @param complete  The callback method to complete the type.
   * @param options   Complete options.
   */
  globalComplete(name, complete, options) {
    return this.complete(name, complete, {
      ...options,
      global: true
    });
  }
  complete(name, complete, options) {
    if (this.cmd.builder.completions.has(name) && !options?.override) {
      throw new DuplicateCompletionError(name);
    }
    this.cmd.builder.completions.set(name, {
      name,
      complete,
      ...options
    });
    return this;
  }
  /**
   * Throw validation errors instead of calling `exit()` to handle
   * validation errors manually.
   *
   * A validation error is thrown when the command is wrongly used by the user.
   * For example: If the user passes some invalid options or arguments to the
   * command.
   *
   * This has no effect for parent commands. Only for the command on which this
   * method was called and all child commands.
   *
   * **Example:**
   *
   * ```ts
   * import { Command, ValidationError } from "./mod.ts";
   *
   * const cmd = new Command();
   * // ...
   *
   * try {
   *   cmd.parse();
   * } catch(error) {
   *   if (error instanceof ValidationError) {
   *     cmd.showHelp();
   *     Deno.exit(1);
   *   }
   *   throw error;
   * }
   * ```
   *
   * @see ValidationError
   */
  throwErrors() {
    this.cmd.settings.throwOnError = true;
    return this;
  }
  /**
   * Set custom error handler.
   *
   * The error handler is inherited by all nested sub-commands, at any depth.
   * The handler closest to the failed command wins. For errors other than
   * {@linkcode ValidationError}, the error is re-thrown to the `.parse()`
   * caller if the handler doesn't exit or throw.
   *
   * @param handler Error handler callback function.
   */
  error(handler) {
    this.cmd.settings.errorHandler = handler;
    return this;
  }
  /** Get error handler callback function from this or any parent command. */
  getErrorHandler() {
    return this.settings.errorHandler ?? this.parent?.getErrorHandler();
  }
  /**
   * Same as `.throwErrors()` but also prevents calling `exit()` after
   * printing help or version with the --help and --version option.
   */
  noExit() {
    this.cmd.settings.shouldExit = false;
    this.throwErrors();
    return this;
  }
  /**
   * Disable inheriting global commands, options and environment variables from
   * parent commands.
   */
  noGlobals() {
    this.cmd.settings.noGlobals = true;
    return this;
  }
  /** Check whether the command should throw errors or exit. */
  shouldThrowErrors() {
    return this.settings.throwOnError || !!this.parent?.shouldThrowErrors();
  }
  /** Check whether the command should exit after printing help or version. */
  shouldExit() {
    return this.settings.shouldExit ?? this.parent?.shouldExit() ?? true;
  }
  /**
   * Enable grouping of options and set the name of the group.
   * All option which are added after calling the `.group()` method will be
   * grouped in the help output. If the `.group()` method can be use multiple
   * times to create more groups.
   *
   * @param name The name of the option group.
   */
  group(name) {
    this.cmd.builder.groupName = name;
    return this;
  }
  /**
   * Register a global option.
   *
   * @param flags Flags string e.g: -h, --help, --manual <requiredArg:string> [optionalArg:number] [...restArgs:string]
   * @param desc Flag description.
   * @param opts Flag options or custom handler for processing flag value.
   */
  globalOption(flags, desc, opts) {
    if (typeof opts === "function") {
      return this.option(flags, desc, {
        value: opts,
        global: true
      });
    }
    return this.option(flags, desc, {
      ...opts,
      global: true
    });
  }
  option(flags, desc, opts) {
    if (typeof opts === "function") {
      opts = {
        value: opts
      };
    }
    const result = splitArguments(flags);
    const args = result.typeDefinition ? parseArgumentsDefinition(result.typeDefinition) : [];
    const option = {
      ...opts,
      name: "",
      description: desc,
      args,
      flags: result.flags,
      equalsSign: result.equalsSign,
      typeDefinition: result.typeDefinition,
      groupName: this.builder.groupName ?? void 0
    };
    if (option.separator) {
      for (const arg of args) {
        if (arg.list) {
          arg.separator = option.separator;
        }
      }
    }
    for (const part of option.flags) {
      const arg = part.trim();
      const isLong = /^--/.test(arg);
      const name = isLong ? arg.slice(2) : arg.slice(1);
      if (this.cmd.getBaseOption(name, true)) {
        if (opts?.override) {
          this.removeOption(name);
        } else {
          throw new DuplicateOptionNameError(name, this.getPath());
        }
      }
      if (!option.name && isLong) {
        option.name = name;
      } else if (!option.aliases) {
        option.aliases = [
          name
        ];
      } else {
        option.aliases.push(name);
      }
    }
    if (option.prepend) {
      this.cmd.builder.options.unshift(option);
    } else {
      this.cmd.builder.options.push(option);
    }
    return this;
  }
  /**
   * Register command example.
   *
   * @param name          Name of the example.
   * @param description   The content of the example.
   */
  example(name, description) {
    if (this.cmd.hasExample(name)) {
      throw new DuplicateExampleError(name);
    }
    this.cmd.settings.examples.push({
      name,
      description
    });
    return this;
  }
  /**
   * @param flags Flags string e.g: -h, --help, --manual <requiredArg:string> [optionalArg:number] [...restArgs:string]
   * @param desc Flag description.
   * @param opts Flag options or custom handler for processing flag value.
   */
  /**
  * Register a global environment variable.
  *
  * @param name        Name of the environment variable.
  * @param description The description of the environment variable.
  * @param options     Environment variable options.
  */
  globalEnv(name, description, options) {
    return this.env(name, description, {
      ...options,
      global: true
    });
  }
  env(name, description, options) {
    const result = splitArguments(name);
    if (!result.typeDefinition) {
      result.typeDefinition = "<value:boolean>";
    }
    if (result.flags.some((envName) => this.cmd.getBaseEnvVar(envName, true))) {
      throw new DuplicateEnvVarError(name);
    }
    const details = parseArgumentsDefinition(result.typeDefinition);
    if (details.length > 1) {
      throw new TooManyEnvVarValuesError(name);
    } else if (details.length && details[0].optional) {
      throw new UnexpectedOptionalEnvVarValueError(name);
    } else if (details.length && details[0].variadic) {
      throw new UnexpectedVariadicEnvVarValueError(name);
    }
    this.cmd.builder.envVars.push({
      name: result.flags[0],
      names: result.flags,
      description,
      type: details[0].type,
      details: details.shift(),
      ...options
    });
    return this;
  }
  /*****************************************************************************
   **** MAIN HANDLER ***********************************************************
   *****************************************************************************/
  /**
  * Parse command line arguments and execute matched command.
  *
  * @param args Command line args to parse. Ex: `cmd.parse( Deno.args )`
  */
  parse(args = getArgs()) {
    this.props.isRoot = true;
    const ctx = {
      unknown: args.slice(),
      flags: {},
      env: {},
      literal: [],
      stopEarly: false,
      stopOnUnknown: false,
      defaults: {},
      actions: [],
      parsedFlags: []
    };
    return this.parseCommand(ctx);
  }
  async parseCommand(ctx) {
    try {
      this.reset();
      this.registerDefaults();
      this.props.rawArgs = ctx.unknown.slice();
      if (this.settings.defaultCommand && !ctx.parsedFlags.length && !ctx.unknown.length) {
        const defaultCommand = this.getCommand(this.settings.defaultCommand, true);
        if (!defaultCommand) {
          throw new DefaultCommandNotFoundError(this.settings.defaultCommand, this.getCommands());
        }
        defaultCommand.props.globalParent = this;
        return defaultCommand.parseCommand(ctx);
      }
      if (this.settings.useRawArgs) {
        await this.parseEnvVars(ctx, this.builder.envVars);
        return await this.execute(ctx.env, ctx.unknown, ctx);
      }
      let preParseGlobals = false;
      let subCommand;
      if (ctx.unknown.length > 0) {
        subCommand = this.getSubCommand(ctx);
        if (!subCommand) {
          const optionName = ctx.unknown[0].replace(/^-+/, "").split("=")[0];
          const option = this.getOption(optionName, true);
          if (option?.global && !option.standalone) {
            preParseGlobals = true;
            await this.parseGlobalOptionsAndEnvVars(ctx);
          }
        }
      }
      if (subCommand || ctx.unknown.length > 0) {
        subCommand ??= this.getSubCommand(ctx);
        if (subCommand) {
          subCommand.props.globalParent = this;
          return subCommand.parseCommand(ctx);
        }
      }
      await this.parseOptionsAndEnvVars(ctx, preParseGlobals);
      const options = {
        ...ctx.env,
        ...ctx.flags
      };
      this.props.parsedOptions = options;
      await this.processArguments(ctx);
      const args = ctx.args ?? [];
      this.props.parsedArgs = args;
      this.props.literalArgs = ctx.literal;
      if (ctx.actions.length) {
        await Promise.all(ctx.actions.map((action) => action.call(this, options, ...args)));
        if (ctx.standalone) {
          return {
            options,
            args,
            cmd: this,
            literal: this.props.literalArgs
          };
        }
      }
      return await this.execute(options, args, ctx);
    } catch (error) {
      this.handleError(error);
    }
  }
  getSubCommand(ctx) {
    const subCommand = this.getCommand(ctx.unknown[0], true);
    if (subCommand) {
      ctx.unknown.shift();
    }
    return subCommand;
  }
  async parseGlobalOptionsAndEnvVars(ctx) {
    const isHelpOption = this.getHelpOption()?.flags.includes(ctx.unknown[0]);
    const envVars = [
      ...this.builder.envVars.filter((envVar) => envVar.global),
      ...this.getGlobalEnvVars(true)
    ];
    await this.parseEnvVars(ctx, envVars, !isHelpOption);
    const options = [
      ...this.builder.options.filter((option) => option.global),
      ...this.getGlobalOptions(true)
    ];
    this.parseOptions(ctx, options, {
      stopEarly: true,
      stopOnUnknown: true,
      dotted: false
    });
  }
  async parseOptionsAndEnvVars(ctx, preParseGlobals) {
    const helpOption = this.getHelpOption();
    const isVersionOption = this.props.versionOption?.flags.includes(ctx.unknown[0]);
    const isHelpOption = helpOption && (preParseGlobals ? ctx.flags?.[helpOption.name] === true : ctx.unknown.some((unknown) => helpOption.flags.includes(unknown)));
    const envVars = preParseGlobals ? this.builder.envVars.filter((envVar) => !envVar.global) : this.getEnvVars(true);
    await this.parseEnvVars(ctx, envVars, !isHelpOption && !isVersionOption);
    const options = this.getOptions(true);
    this.parseOptions(ctx, options, {
      args: this.getArguments()
    });
  }
  /** Register default options like `--version` and `--help`. */
  registerDefaults() {
    if (this.props.hasDefaults) {
      return this;
    }
    if (this.parent) {
      if (this.props.isRoot) {
        this.getMainCommand().registerDefaults();
      }
      return this;
    }
    this.props.hasDefaults = true;
    this.reset();
    !this.builder.types.has("string") && this.type("string", new StringType(), {
      global: true
    });
    !this.builder.types.has("number") && this.type("number", new NumberType(), {
      global: true
    });
    !this.builder.types.has("integer") && this.type("integer", new IntegerType(), {
      global: true
    });
    !this.builder.types.has("boolean") && this.type("boolean", new BooleanType(), {
      global: true
    });
    !this.builder.types.has("file") && this.type("file", new FileType(), {
      global: true
    });
    !this.builder.types.has("secret") && this.type("secret", new SecretType(), {
      global: true
    });
    if (!this.settings.help) {
      this.help({});
    }
    if (this.settings.versionOptions !== false && (this.settings.versionOptions || this.settings.version)) {
      this.option(this.settings.versionOptions?.flags || "-V, --version", this.settings.versionOptions?.desc || "Show the version number for this program.", {
        standalone: true,
        prepend: true,
        action: async function() {
          const long = this.getRawArgs().includes(`--${this.props.versionOption?.name}`);
          if (long) {
            await checkVersion(this);
            this.showLongVersion();
          } else {
            this.showVersion();
          }
          this.exit();
        },
        ...this.settings.versionOptions?.opts ?? {}
      });
      this.props.versionOption = this.builder.options[0];
    }
    if (this.settings.helpOptions !== false) {
      this.option(this.settings.helpOptions?.flags || "-h, --help", this.settings.helpOptions?.desc || "Show this help.", {
        standalone: true,
        global: true,
        prepend: true,
        action: async function() {
          const long = this.getRawArgs().includes(`--${this.getHelpOption()?.name}`);
          await checkVersion(this);
          this.showHelp({
            long
          });
          this.exit();
        },
        ...this.settings.helpOptions?.opts ?? {}
      });
      this.props.helpOption = this.builder.options[0];
    }
    return this;
  }
  /**
   * Execute command.
   * @param options A map of all options and environment variables. This also
   * includes global options and environment variables. The options are parsed
   * and processed by the command before passed to the action handler.
   * @param args Positional arguments array.
   * @param ctx Parse context.
   */
  async execute(options, args, ctx) {
    if (this.settings.commands.size && !ctx.unknown.length && !ctx.parsedFlags.length && !this.settings.actionHandler && this.isAutoHelpEnabled()) {
      this.showHelp();
      this.exit();
    }
    await this.executeGlobalAction(options, args);
    await this.settings.actionHandler?.call(this, options, ...args);
    return {
      options,
      args,
      cmd: this,
      literal: this.props.literalArgs
    };
  }
  async executeGlobalAction(options, args) {
    if (!this.settings.noGlobals) {
      await this.parent?.executeGlobalAction(options, args);
    }
    await this.settings.globalActionHandler?.call(this, options, ...args);
  }
  /** Parse raw command line arguments. */
  parseOptions(ctx, options, { stopEarly = this.settings.stopEarly, stopOnUnknown = false, dotted = true, args = [] } = {}) {
    parseFlags(ctx, {
      stopEarly,
      stopOnUnknown,
      dotted,
      allowEmpty: this.settings.allowEmpty,
      flags: options,
      args,
      ignoreDefaults: ctx.env,
      parse: (type) => this.parseType(type),
      option: (option) => {
        if (option.action) {
          ctx.actions.push(option.action);
        }
      }
    });
  }
  /** Parse argument type. */
  parseType(type) {
    const typeSettings = this.getType(type.type);
    if (!typeSettings) {
      throw new UnknownTypeError(type.type, this.getTypes().map((type2) => type2.name));
    }
    return typeSettings.handler instanceof Type ? typeSettings.handler.parse(type) : typeSettings.handler(type);
  }
  /**
   * Read and validate environment variables.
   * @param ctx Parse context.
   * @param envVars env vars defined by the command.
   * @param validate when true, throws an error if a required env var is missing.
   */
  async parseEnvVars(ctx, envVars, validate = true) {
    await Promise.all(envVars.map(async (envVar) => {
      const env = await this.findEnvVar(envVar.names);
      if (env) {
        const parseType = (value) => {
          return this.parseType({
            label: "Environment variable",
            type: envVar.type,
            name: env.name,
            value
          });
        };
        const propertyName = underscoreToCamelCase(envVar.prefix ? envVar.names[0].replace(new RegExp(`^${envVar.prefix}`), "") : envVar.names[0]);
        if (envVar.details.list) {
          ctx.env[propertyName] = env.value.split(envVar.details.separator ?? ",").map(parseType);
        } else {
          ctx.env[propertyName] = parseType(env.value);
        }
        if (envVar.value && typeof ctx.env[propertyName] !== "undefined") {
          ctx.env[propertyName] = envVar.value(ctx.env[propertyName]);
        }
      } else if (envVar.required && validate) {
        throw new MissingRequiredEnvVarError(envVar);
      }
    }));
  }
  async findEnvVar(names) {
    const statuses = await Promise.all(names.map(async (name) => {
      const status = await globalThis.Deno?.permissions.query({
        name: "env",
        variable: name
      });
      return {
        name,
        status
      };
    }));
    for (const { name, status } of statuses) {
      if (!status || status.state === "granted") {
        const value = getEnv(name);
        if (value) {
          return {
            name,
            value
          };
        }
      }
    }
    return void 0;
  }
  /**
   * Processes command-line arguments.
   *
   * @param ctx Parse context.
   */
  async processArguments(ctx) {
    if (!this.hasArguments() && ctx.unknown.length) {
      if (this.hasCommands(true)) {
        if (this.hasCommand(ctx.unknown[0], true)) {
          throw new TooManyArgumentsError2(ctx.unknown);
        } else {
          throw new UnknownCommandError(ctx.unknown[0], this.getCommands());
        }
      } else {
        throw new NoArgumentsAllowedError(this.getPath());
      }
    }
    if (ctx.args?.length) {
      ctx.args = await Promise.all(ctx.args ?? []);
    } else if (ctx.stopEarly || ctx.stopOnUnknown) {
      ctx.args = ctx.unknown;
    }
  }
  handleError(error) {
    this.throw(error instanceof ValidationError ? new ValidationError2(error.message, {
      cause: error
    }) : error instanceof Error ? error : new Error(`[non-error-thrown] ${error}`));
  }
  /**
   * Handle error. If `throwErrors` is enabled the error will be thrown,
   * otherwise a formatted error message will be printed and `exit(1)`
   * will be called. This will also trigger registered error handlers.
   *
   * @param error The error to handle.
   */
  throw(error) {
    if (error instanceof ValidationError2) {
      error.cmd = this;
    }
    this.getErrorHandler()?.(error, this, {
      options: this.props.parsedOptions ?? {},
      args: this.props.parsedArgs ?? []
    });
    if (this.shouldThrowErrors() || !(error instanceof ValidationError2)) {
      throw error;
    }
    this.showHelp();
    console.error(red(`  ${bold("error")}: ${error.message}
`));
    exit(error instanceof ValidationError2 ? error.exitCode : 1);
  }
  /*****************************************************************************
   **** GETTER *****************************************************************
   *****************************************************************************/
  /** Get command name. */
  getName() {
    return this.settings.name;
  }
  /** Get parent command. */
  getParent() {
    return this.parent;
  }
  /**
   * Get parent command from global executed command.
   * Be sure, to call this method only inside an action handler. Unless this or any child command was executed,
   * this method returns always undefined.
   */
  getGlobalParent() {
    return this.props.globalParent;
  }
  /** Get main command. */
  getMainCommand() {
    return this.parent?.getMainCommand() ?? this;
  }
  /** Get command name aliases. */
  getAliases() {
    return this.settings.aliases;
  }
  /**
   * Get full command path.
   *
   * @param name Override the main command name.
   */
  getPath(name) {
    return this.parent && !this.props.isRoot ? this.parent.getPath(name) + " " + this.settings.name : name || this.settings.name;
  }
  /** Get arguments definition. E.g: <input-file:string> <output-file:string> */
  getArgsDefinition() {
    return this.settings.arguments?.map(({ arg }) => arg).join(" ");
  }
  /**
   * Get argument by name.
   *
   * @param name Name of the argument.
   */
  getArgument(name) {
    return this.getArguments().find((arg) => arg.name === name);
  }
  /** Get arguments. */
  getArguments() {
    if (!this.props.args.length && this.settings.arguments) {
      this.props.args = parseArgumentsDefinition(this.settings.arguments);
    }
    return this.props.args;
  }
  /** Check if command has arguments. */
  hasArguments() {
    return !!this.settings.arguments?.length;
  }
  /** Get command version. */
  getVersion() {
    return this.getVersionHandler()?.call(this, this);
  }
  /** Get help handler method. */
  getVersionHandler() {
    return this.settings.version ?? this.parent?.getVersionHandler();
  }
  /** Get command description. */
  getDescription() {
    return typeof this.settings.description === "function" ? this.settings.description = this.settings.description.call(this) : this.settings.description;
  }
  /** Get auto generated command usage. */
  getUsage() {
    return this.settings.usage ?? [
      this.getArgsDefinition(),
      this.getRequiredOptionsDefinition()
    ].join(" ").trim();
  }
  getRequiredOptionsDefinition() {
    return this.getOptions().filter((option) => option.required).map((option) => [
      findFlag(option.flags),
      option.typeDefinition
    ].filter((v) => v).join(" ").trim()).join(" ");
  }
  /** Get short command description. This is the first line of the description. */
  getShortDescription() {
    return getDescription(this.getDescription(), true);
  }
  /** Get original command-line arguments. */
  getRawArgs() {
    return this.props.rawArgs;
  }
  /** Get all arguments defined after the double dash. */
  getLiteralArgs() {
    return this.props.literalArgs;
  }
  /** Output generated help without exiting. */
  showVersion() {
    console.log(this.getVersion());
  }
  /** Returns command name, version and meta data. */
  getLongVersion() {
    return `${bold(this.getMainCommand().getName())} ${brightBlue(this.getVersion() ?? "")}` + Object.entries(this.getMeta()).map(([k, v]) => `
${bold(k)} ${brightBlue(v)}`).join("");
  }
  /** Outputs command name, version and meta data. */
  showLongVersion() {
    console.log(this.getLongVersion());
  }
  /** Output generated help without exiting. */
  showHelp(options) {
    console.log(this.getHelp(options));
  }
  /** Get generated help. */
  getHelp(options) {
    this.registerDefaults();
    return this.getHelpHandler().call(this, this, options ?? {});
  }
  /** Get help handler method. */
  getHelpHandler() {
    return this.settings.help ?? this.parent?.getHelpHandler();
  }
  exit(code2 = 0) {
    if (this.shouldExit()) {
      exit(code2);
    }
  }
  /*****************************************************************************
   **** Options GETTER *********************************************************
   *****************************************************************************/
  /**
  * Checks whether the command has options or not.
  *
  * @param hidden Include hidden options.
  */
  hasOptions(hidden) {
    return this.getOptions(hidden).length > 0;
  }
  /**
   * Get options.
   *
   * @param hidden Include hidden options.
   */
  getOptions(hidden) {
    return this.getGlobalOptions(hidden).concat(this.getBaseOptions(hidden));
  }
  /**
   * Get base options.
   *
   * @param hidden Include hidden options.
   */
  getBaseOptions(hidden) {
    if (!this.builder.options.length) {
      return [];
    }
    return hidden ? this.builder.options.slice(0) : this.builder.options.filter((opt) => !opt.hidden);
  }
  /**
   * Get global options.
   *
   * @param hidden Include hidden options.
   */
  getGlobalOptions(hidden) {
    const helpOption = this.getHelpOption();
    const getGlobals = (cmd, noGlobals, options = [], names = []) => {
      if (cmd.builder.options.length) {
        for (const option of cmd.builder.options) {
          if (option.global && !this.builder.options.find((opt) => opt.name === option.name) && names.indexOf(option.name) === -1 && (hidden || !option.hidden)) {
            if (noGlobals && option !== helpOption) {
              continue;
            }
            names.push(option.name);
            options.push(option);
          }
        }
      }
      return cmd.parent ? getGlobals(cmd.parent, noGlobals || cmd.settings.noGlobals, options, names) : options;
    };
    return this.parent ? getGlobals(this.parent, this.settings.noGlobals) : [];
  }
  /**
   * Checks whether the command has an option with given name or not.
   *
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  hasOption(name, hidden) {
    return !!this.getOption(name, hidden);
  }
  /**
   * Get option by name.
   *
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  getOption(name, hidden) {
    return this.getBaseOption(name, hidden) ?? this.getGlobalOption(name, hidden);
  }
  /**
   * Get base option by name.
   *
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  getBaseOption(name, hidden) {
    const option = this.builder.options.find((option2) => option2.name === name || option2.aliases?.includes(name));
    return option && (hidden || !option.hidden) ? option : void 0;
  }
  /**
   * Get global option from parent commands by name.
   *
   * @param name Name of the option. Must be in param-case.
   * @param hidden Include hidden options.
   */
  getGlobalOption(name, hidden) {
    const helpOption = this.getHelpOption();
    const getGlobalOption = (parent, noGlobals) => {
      const option = parent.getBaseOption(name, hidden);
      if (!option?.global) {
        return parent.parent && getGlobalOption(parent.parent, noGlobals || parent.settings.noGlobals);
      }
      if (noGlobals && option !== helpOption) {
        return;
      }
      return option;
    };
    return this.parent && getGlobalOption(this.parent, this.settings.noGlobals);
  }
  /**
   * Remove option by name.
   *
   * @param name Name of the option. Must be in param-case.
   */
  removeOption(name) {
    const index = this.builder.options.findIndex((option) => option.name === name);
    if (index === -1) {
      return;
    }
    return this.builder.options.splice(index, 1)[0];
  }
  /**
   * Checks whether the command has sub-commands or not.
   *
   * @param hidden Include hidden commands.
   */
  hasCommands(hidden) {
    return this.getCommands(hidden).length > 0;
  }
  /**
   * Get commands.
   *
   * @param hidden Include hidden commands.
   */
  getCommands(hidden) {
    return this.getGlobalCommands(hidden).concat(this.getBaseCommands(hidden));
  }
  /**
   * Get base commands.
   *
   * @param hidden Include hidden commands.
   */
  getBaseCommands(hidden) {
    const commands = Array.from(this.settings.commands.values());
    return hidden ? commands : commands.filter((cmd) => !cmd.settings.isHidden);
  }
  /**
   * Get global commands.
   *
   * @param hidden Include hidden commands.
   */
  getGlobalCommands(hidden) {
    const getCommands = (command, noGlobals, commands = [], names = []) => {
      if (command.settings.commands.size) {
        for (const [_, cmd] of command.settings.commands) {
          if (cmd.settings.isGlobal && this !== cmd && !this.settings.commands.has(cmd.settings.name) && names.indexOf(cmd.settings.name) === -1 && (hidden || !cmd.settings.isHidden)) {
            if (noGlobals && cmd?.getName() !== "help") {
              continue;
            }
            names.push(cmd.settings.name);
            commands.push(cmd);
          }
        }
      }
      return command.parent ? getCommands(command.parent, noGlobals || command.settings.noGlobals, commands, names) : commands;
    };
    return this.parent ? getCommands(this.parent, this.settings.noGlobals) : [];
  }
  /**
   * Checks whether a child command exists by given name or alias.
   *
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  hasCommand(name, hidden) {
    return !!this.getCommand(name, hidden);
  }
  /**
   * Get command by name or alias.
   *
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  getCommand(name, hidden) {
    return this.getBaseCommand(name, hidden) ?? this.getGlobalCommand(name, hidden);
  }
  /**
   * Get base command by name or alias.
   *
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  getBaseCommand(name, hidden) {
    for (const cmd of this.settings.commands.values()) {
      if (cmd.settings.name === name || cmd.settings.aliases.includes(name)) {
        return cmd && (hidden || !cmd.settings.isHidden) ? cmd : void 0;
      }
    }
  }
  /**
   * Get global command by name or alias.
   *
   * @param name Name or alias of the command.
   * @param hidden Include hidden commands.
   */
  getGlobalCommand(name, hidden) {
    const getGlobalCommand = (parent, noGlobals) => {
      const cmd = parent.getBaseCommand(name, hidden);
      if (!cmd || !cmd.settings.isGlobal) {
        return parent.parent && getGlobalCommand(parent.parent, noGlobals || parent.settings.noGlobals);
      }
      if (noGlobals && cmd.getName() !== "help") {
        return;
      }
      return cmd;
    };
    return this.parent && getGlobalCommand(this.parent, this.settings.noGlobals);
  }
  /**
   * Remove sub-command by name or alias.
   *
   * @param name Name or alias of the command.
   */
  removeCommand(name) {
    const command = this.getBaseCommand(name, true);
    if (command) {
      this.settings.commands.delete(command.settings.name);
    }
    return command;
  }
  /** Get types. */
  getTypes() {
    return this.getGlobalTypes().concat(this.getBaseTypes());
  }
  /** Get base types. */
  getBaseTypes() {
    return Array.from(this.builder.types.values());
  }
  /** Get global types. */
  getGlobalTypes() {
    const getTypes = (cmd, types = [], names = []) => {
      if (cmd) {
        if (cmd.builder.types.size) {
          cmd.builder.types.forEach((type) => {
            if (type.global && !this.builder.types.has(type.name) && names.indexOf(type.name) === -1) {
              names.push(type.name);
              types.push(type);
            }
          });
        }
        return getTypes(cmd.parent, types, names);
      }
      return types;
    };
    return getTypes(this.parent);
  }
  /**
   * Get type by name.
   *
   * @param name Name of the type.
   */
  getType(name) {
    return this.getBaseType(name) ?? this.getGlobalType(name);
  }
  /**
   * Get base type by name.
   *
   * @param name Name of the type.
   */
  getBaseType(name) {
    return this.builder.types.get(name);
  }
  /**
   * Get global type by name.
   *
   * @param name Name of the type.
   */
  getGlobalType(name) {
    if (!this.parent) {
      return;
    }
    const cmd = this.parent.getBaseType(name);
    if (!cmd?.global) {
      return this.parent.getGlobalType(name);
    }
    return cmd;
  }
  /** Get completions. */
  getCompletions() {
    return this.getGlobalCompletions().concat(this.getBaseCompletions());
  }
  /** Get base completions. */
  getBaseCompletions() {
    return Array.from(this.builder.completions.values());
  }
  /** Get global completions. */
  getGlobalCompletions() {
    const getCompletions = (cmd, completions = [], names = []) => {
      if (cmd) {
        if (cmd.builder.completions.size) {
          cmd.builder.completions.forEach((completion) => {
            if (completion.global && !this.builder.completions.has(completion.name) && names.indexOf(completion.name) === -1) {
              names.push(completion.name);
              completions.push(completion);
            }
          });
        }
        return getCompletions(cmd.parent, completions, names);
      }
      return completions;
    };
    return getCompletions(this.parent);
  }
  /**
   * Get completion by name.
   *
   * @param name Name of the completion.
   */
  getCompletion(name) {
    return this.getBaseCompletion(name) ?? this.getGlobalCompletion(name);
  }
  /**
   * Get base completion by name.
   *
   * @param name Name of the completion.
   */
  getBaseCompletion(name) {
    return this.builder.completions.get(name);
  }
  /**
   * Get global completions by name.
   *
   * @param name Name of the completion.
   */
  getGlobalCompletion(name) {
    if (!this.parent) {
      return;
    }
    const completion = this.parent.getBaseCompletion(name);
    if (!completion?.global) {
      return this.parent.getGlobalCompletion(name);
    }
    return completion;
  }
  /**
   * Checks whether the command has environment variables or not.
   *
   * @param hidden Include hidden environment variable.
   */
  hasEnvVars(hidden) {
    return this.getEnvVars(hidden).length > 0;
  }
  /**
   * Get environment variables.
   *
   * @param hidden Include hidden environment variable.
   */
  getEnvVars(hidden) {
    return this.getGlobalEnvVars(hidden).concat(this.getBaseEnvVars(hidden));
  }
  /**
   * Get base environment variables.
   *
   * @param hidden Include hidden environment variable.
   */
  getBaseEnvVars(hidden) {
    if (!this.builder.envVars.length) {
      return [];
    }
    return hidden ? this.builder.envVars.slice(0) : this.builder.envVars.filter((env) => !env.hidden);
  }
  /**
   * Get global environment variables.
   *
   * @param hidden Include hidden environment variable.
   */
  getGlobalEnvVars(hidden) {
    if (this.settings.noGlobals) {
      return [];
    }
    const getEnvVars = (cmd, envVars = [], names = []) => {
      if (cmd) {
        if (cmd.builder.envVars.length) {
          cmd.builder.envVars.forEach((envVar) => {
            if (envVar.global && !this.builder.envVars.find((env) => env.names[0] === envVar.names[0]) && names.indexOf(envVar.names[0]) === -1 && (hidden || !envVar.hidden)) {
              names.push(envVar.names[0]);
              envVars.push(envVar);
            }
          });
        }
        return getEnvVars(cmd.parent, envVars, names);
      }
      return envVars;
    };
    return getEnvVars(this.parent);
  }
  /**
   * Checks whether the command has an environment variable with given name or not.
   *
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  hasEnvVar(name, hidden) {
    return !!this.getEnvVar(name, hidden);
  }
  /**
   * Get environment variable by name.
   *
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  getEnvVar(name, hidden) {
    return this.getBaseEnvVar(name, hidden) ?? this.getGlobalEnvVar(name, hidden);
  }
  /**
   * Get base environment variable by name.
   *
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  getBaseEnvVar(name, hidden) {
    const envVar = this.builder.envVars.find((env) => env.names.indexOf(name) !== -1);
    return envVar && (hidden || !envVar.hidden) ? envVar : void 0;
  }
  /**
   * Get global environment variable by name.
   *
   * @param name Name of the environment variable.
   * @param hidden Include hidden environment variable.
   */
  getGlobalEnvVar(name, hidden) {
    if (!this.parent || this.settings.noGlobals) {
      return;
    }
    const envVar = this.parent.getBaseEnvVar(name, hidden);
    if (!envVar?.global) {
      return this.parent.getGlobalEnvVar(name, hidden);
    }
    return envVar;
  }
  /** Checks whether the command has examples or not. */
  hasExamples() {
    return this.settings.examples.length > 0;
  }
  /** Get all examples. */
  getExamples() {
    return this.settings.examples;
  }
  /** Checks whether the command has an example with given name or not. */
  hasExample(name) {
    return !!this.getExample(name);
  }
  /** Get example with given name. */
  getExample(name) {
    return this.settings.examples.find((example) => example.name === name);
  }
  getHelpOption() {
    return this.props.helpOption ?? this.parent?.getHelpOption();
  }
  isAutoHelpEnabled() {
    return this.settings.autoHelp ?? this.parent?.isAutoHelpEnabled() ?? true;
  }
};
function findFlag(flags) {
  for (const flag of flags) {
    if (flag.startsWith("--")) {
      return flag;
    }
  }
  return flags[0];
}

// src/cli.ts
import { resolve as resolve8 } from "node:path";

// src/applier.ts
import { randomUUID } from "node:crypto";
import { lstat as lstat2, mkdir, readFile as readFile4, rename, symlink, writeFile } from "node:fs/promises";
import { dirname as dirname2, join as join3 } from "node:path";

// src/planner.ts
import { createHash } from "node:crypto";
import { lstat, readFile as readFile3, readlink } from "node:fs/promises";
import { join as join2, resolve as resolve3, sep as sep2 } from "node:path";

// src/assets.ts
import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
async function findDistributionRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, ".."), resolve(here, "../..")];
  for (const candidate of candidates) {
    if (await exists(join(candidate, "skills")) && await exists(join(candidate, "rules"))) {
      return candidate;
    }
  }
  throw new Error("Cannot locate wfctl distribution assets");
}
async function renderAgentInstructions(distributionRoot, profile, knowledgePath) {
  const common = await readFile(join(distributionRoot, "templates/agents/common.md"), "utf8");
  const specific = await readFile(join(distributionRoot, `templates/agents/${profile}.md`), "utf8");
  return `${common.trimEnd()}
${specific}`.replaceAll("{{KNOWLEDGE_PATH}}", knowledgePath ?? "(not configured)").trim();
}
async function collectFiles(root) {
  if (!await exists(root)) {
    return [];
  }
  const result = [];
  await visit3(root, "");
  return result.sort();
  async function visit3(current, relative2) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = relative2 ? join(relative2, entry.name) : entry.name;
      const child = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit3(child, childRelative);
      } else if (entry.isFile()) {
        result.push(childRelative);
      }
    }
  }
}
async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// src/config.ts
import { readFile as readFile2 } from "node:fs/promises";
import { isAbsolute, relative, resolve as resolve2, sep } from "node:path";

// src/types.ts
var WORKFLOW_VERSION = "0.1.0";
var CONFIG_SCHEMA_VERSION = 1;
var STATE_SCHEMA_VERSION = 1;

// src/config.ts
function createConfig(profile, target, knowledge) {
  const config = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    profile,
    installedVersion: WORKFLOW_VERSION
  };
  if (profile === "leaf") {
    if (!knowledge) {
      throw new Error("Leaf profile requires --knowledge <path>");
    }
    config.knowledge = { path: portableRelative(target, knowledge) };
  }
  return config;
}
async function readConfig(target) {
  const path = resolve2(target, ".workflow/config.json");
  const raw = JSON.parse(await readFile2(path, "utf8"));
  if (raw.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new Error(`Unsupported workflow config schema in ${path}`);
  }
  if (raw.profile !== "knowledge" && raw.profile !== "leaf") {
    throw new Error(`Invalid workflow profile in ${path}`);
  }
  if (raw.profile === "leaf" && !raw.knowledge?.path) {
    throw new Error(`Leaf workflow config has no knowledge path in ${path}`);
  }
  return raw;
}
async function readState(target) {
  try {
    const raw = JSON.parse(
      await readFile2(resolve2(target, ".workflow/state.json"), "utf8")
    );
    if (raw.schemaVersion !== STATE_SCHEMA_VERSION || !raw.files || !raw.profile) {
      throw new Error("invalid state shape");
    }
    return raw;
  } catch (error) {
    if (isMissingFileError(error)) {
      return void 0;
    }
    throw new Error(`Cannot read .workflow/state.json: ${errorMessage(error)}`);
  }
}
function resolveKnowledgeRoot(target, config) {
  if (config.profile === "knowledge") {
    return resolve2(target);
  }
  const configured = config.knowledge?.path;
  if (!configured) {
    throw new Error("Leaf workflow config has no knowledge path");
  }
  return isAbsolute(configured) ? configured : resolve2(target, configured);
}
function portableRelative(from, to) {
  const value = relative(resolve2(from), resolve2(to)).split(sep).join("/");
  if (value === "") {
    return ".";
  }
  return value.startsWith(".") ? value : `./${value}`;
}
function isMissingFileError(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/managed-block.ts
var START_MARKER = "<!-- wfctl:begin -->";
var END_MARKER = "<!-- wfctl:end -->";
function renderManagedBlock(body) {
  return `${START_MARKER}
${body.trim()}
${END_MARKER}`;
}
function upsertManagedBlock(existing, body) {
  const startCount = count(existing, START_MARKER);
  const endCount = count(existing, END_MARKER);
  if (startCount === 0 && endCount === 0) {
    const prefix = existing.trimEnd();
    const separator = prefix.length === 0 ? "" : "\n\n";
    return { content: `${prefix}${separator}${renderManagedBlock(body)}
` };
  }
  if (startCount !== 1 || endCount !== 1) {
    return { error: "managed block markers are malformed or duplicated" };
  }
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  if (end < start) {
    return { error: "managed block end marker appears before its start marker" };
  }
  const after = end + END_MARKER.length;
  return {
    content: `${existing.slice(0, start)}${renderManagedBlock(body)}${existing.slice(after)}`
  };
}
function count(value, needle) {
  return value.split(needle).length - 1;
}

// src/planner.ts
var REQUIRED_DIRECTORIES = [
  ".agents/skills",
  ".claude/rules",
  ".workflow/rules",
  ".workflow/current"
];
var KNOWLEDGE_DIRECTORIES = [
  "raw",
  "changes/active",
  "changes/archive"
];
var COMMON_SKILLS = [
  "analyze-with-graphify",
  "setup-workflow-environment"
];
var PROFILE_SKILLS = {
  knowledge: ["curate-project-knowledge"],
  leaf: [
    "align-project-knowledge",
    "manage-project-work",
    "verify-project-work"
  ]
};
async function buildInstallPlan(options) {
  const target = resolve3(options.target);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const state = await readState(target);
  const config = createConfig(options.profile, target, options.knowledge);
  const operations = [];
  for (const directory of REQUIRED_DIRECTORIES) {
    operations.push(await planDirectory(target, directory));
  }
  if (options.profile === "knowledge") {
    for (const directory of KNOWLEDGE_DIRECTORIES) {
      operations.push(await planDirectory(target, directory));
    }
  }
  operations.push(await planConfig(target, config));
  const instructions = await renderAgentInstructions(
    distributionRoot,
    options.profile,
    config.knowledge?.path
  );
  operations.push(await planManagedBlock(target, "AGENTS.md", instructions));
  operations.push(await planClaudeInstructions(target, instructions));
  const skillNames = skillsForProfile(options.profile);
  for (const skillName of skillNames) {
    const sourceRoot = join2(distributionRoot, "skills", skillName);
    const files = await collectFiles(sourceRoot);
    if (files.length === 0) {
      throw new Error(`Workflow skill is missing from distribution: ${sourceRoot}`);
    }
    await planOwnedTree({
      sourceRoot,
      destinationRoot: join2(".agents/skills", skillName),
      target,
      state,
      operations
    });
  }
  const ruleRoots = [
    join2(distributionRoot, "rules/common"),
    join2(distributionRoot, `rules/${options.profile}`)
  ];
  for (const ruleRoot of ruleRoots) {
    await planOwnedTree({
      sourceRoot: ruleRoot,
      destinationRoot: ".workflow/rules",
      target,
      state,
      operations
    });
    await planOwnedTree({
      sourceRoot: ruleRoot,
      destinationRoot: ".claude/rules",
      target,
      state,
      operations
    });
  }
  if (options.profile === "knowledge") {
    await planOwnedTree({
      sourceRoot: join2(distributionRoot, "templates/knowledge"),
      destinationRoot: ".",
      target,
      state,
      operations
    });
  }
  await planClaudeSkills(target, skillNames, operations);
  return {
    target,
    profile: options.profile,
    ...config.knowledge ? { knowledgePath: config.knowledge.path } : {},
    operations: sortOperations(operations)
  };
}
function summarizePlan(plan) {
  const counts = Object.fromEntries(
    ["create", "update", "unchanged", "conflict"].map((status) => [
      status,
      plan.operations.filter((operation) => operation.status === status).length
    ])
  );
  return {
    target: plan.target,
    profile: plan.profile,
    ...plan.knowledgePath ? { knowledgePath: plan.knowledgePath } : {},
    counts,
    operations: plan.operations.map(
      ({ content: _content, expectedHash: _expected, ...operation }) => operation
    )
  };
}
function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}
async function planConfig(target, desired) {
  const relativePath = ".workflow/config.json";
  const absolute = join2(target, relativePath);
  const content = `${JSON.stringify(desired, null, 2)}
`;
  try {
    const existing = await readFile3(absolute, "utf8");
    const parsed = JSON.parse(existing);
    const sameKnowledge = desired.profile !== "leaf" || parsed.knowledge?.path === desired.knowledge?.path;
    if (parsed.schemaVersion === desired.schemaVersion && parsed.profile === desired.profile && sameKnowledge) {
      return {
        kind: "file",
        path: relativePath,
        status: "unchanged",
        reason: "existing workflow configuration is compatible",
        content: existing
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: "existing workflow configuration differs; update it explicitly"
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      return {
        kind: "file",
        path: relativePath,
        status: "conflict",
        reason: `cannot inspect configuration: ${errorMessage(error)}`
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "create",
      reason: "workflow configuration is absent",
      content
    };
  }
}
async function planDirectory(target, relativePath) {
  try {
    const stat = await lstat(join2(target, relativePath));
    if (stat.isDirectory()) {
      return {
        kind: "directory",
        path: relativePath,
        status: "unchanged",
        reason: "directory exists"
      };
    }
    return {
      kind: "directory",
      path: relativePath,
      status: "conflict",
      reason: "path exists and is not a directory"
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "directory",
        path: relativePath,
        status: "create",
        reason: "directory is absent"
      };
    }
    return {
      kind: "directory",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect directory: ${errorMessage(error)}`
    };
  }
}
async function planManagedBlock(target, relativePath, body) {
  const absolute = join2(target, relativePath);
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: "instruction file is a symlink not owned by this operation"
      };
    }
    if (!stat.isFile()) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: "instruction path exists and is not a regular file"
      };
    }
    const existing = await readFile3(absolute, "utf8");
    const merged = upsertManagedBlock(existing, body);
    if (!merged.content) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: merged.error ?? "cannot update managed block"
      };
    }
    const status = merged.content === existing ? "unchanged" : "update";
    return {
      kind: "managed-block",
      path: relativePath,
      status,
      reason: status === "unchanged" ? "managed block is current" : "managed block will be updated",
      content: merged.content,
      expectedHash: hashContent(existing)
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: `cannot inspect instruction file: ${errorMessage(error)}`
      };
    }
    const merged = upsertManagedBlock("", body);
    return {
      kind: "managed-block",
      path: relativePath,
      status: "create",
      reason: "instruction file is absent",
      content: merged.content ?? ""
    };
  }
}
async function planClaudeInstructions(target, body) {
  const path = "CLAUDE.md";
  const absolute = join2(target, path);
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) {
      const current = await readlink(absolute);
      return current === "AGENTS.md" ? {
        kind: "symlink",
        path,
        status: "unchanged",
        reason: "CLAUDE.md already links to AGENTS.md",
        linkTarget: current
      } : {
        kind: "symlink",
        path,
        status: "conflict",
        reason: `CLAUDE.md links to ${current}, not AGENTS.md`
      };
    }
    return await planManagedBlock(target, path, body);
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "symlink",
        path,
        status: "create",
        reason: "CLAUDE.md is absent",
        linkTarget: "AGENTS.md"
      };
    }
    return {
      kind: "symlink",
      path,
      status: "conflict",
      reason: `cannot inspect CLAUDE.md: ${errorMessage(error)}`
    };
  }
}
async function planOwnedTree(input) {
  for (const sourceRelative of await collectFiles(input.sourceRoot)) {
    const destination = normalizeRelative(join2(input.destinationRoot, sourceRelative));
    const content = await readFile3(join2(input.sourceRoot, sourceRelative), "utf8");
    input.operations.push(
      await planOwnedFile(input.target, destination, content, input.state)
    );
  }
}
async function planOwnedFile(target, relativePath, content, state) {
  const absolute = join2(target, relativePath);
  const desiredHash = hashContent(content);
  try {
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        kind: "file",
        path: relativePath,
        status: "conflict",
        reason: "owned destination exists and is not a regular file"
      };
    }
    const existing = await readFile3(absolute);
    const currentHash = hashContent(existing);
    if (currentHash === desiredHash) {
      return {
        kind: "file",
        path: relativePath,
        status: "unchanged",
        reason: "owned file is current",
        content,
        expectedHash: currentHash,
        track: true
      };
    }
    const installedHash = state?.files[relativePath]?.sha256;
    if (installedHash && installedHash === currentHash) {
      return {
        kind: "file",
        path: relativePath,
        status: "update",
        reason: "owned file matches the previous installed version",
        content,
        expectedHash: currentHash,
        track: true
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: installedHash ? "owned file was locally modified" : "destination exists without wfctl ownership"
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "file",
        path: relativePath,
        status: "create",
        reason: "owned file is absent",
        content,
        track: true
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect owned file: ${errorMessage(error)}`
    };
  }
}
async function planClaudeSkills(target, skillNames, operations) {
  const path = ".claude/skills";
  const absolute = join2(target, path);
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) {
      const current = await readlink(absolute);
      operations.push(
        current === "../.agents/skills" ? {
          kind: "symlink",
          path,
          status: "unchanged",
          reason: "Claude skills link is current",
          linkTarget: current
        } : {
          kind: "symlink",
          path,
          status: "conflict",
          reason: `Claude skills links to ${current}`
        }
      );
      return;
    }
    if (!stat.isDirectory()) {
      operations.push({
        kind: "symlink",
        path,
        status: "conflict",
        reason: "Claude skills path exists and is not a directory"
      });
      return;
    }
    for (const skillName of skillNames) {
      const childPath = normalizeRelative(join2(path, skillName));
      const linkTarget = normalizeRelative(join2("../../.agents/skills", skillName));
      operations.push(await planSymlink(target, childPath, linkTarget));
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      operations.push({
        kind: "symlink",
        path,
        status: "create",
        reason: "Claude skills path is absent",
        linkTarget: "../.agents/skills"
      });
      return;
    }
    operations.push({
      kind: "symlink",
      path,
      status: "conflict",
      reason: `cannot inspect Claude skills: ${errorMessage(error)}`
    });
  }
}
async function planSymlink(target, relativePath, linkTarget) {
  try {
    const stat = await lstat(join2(target, relativePath));
    if (!stat.isSymbolicLink()) {
      return {
        kind: "symlink",
        path: relativePath,
        status: "conflict",
        reason: "path exists and is not a symlink"
      };
    }
    const current = await readlink(join2(target, relativePath));
    return current === linkTarget ? {
      kind: "symlink",
      path: relativePath,
      status: "unchanged",
      reason: "symlink is current",
      linkTarget
    } : {
      kind: "symlink",
      path: relativePath,
      status: "conflict",
      reason: `symlink points to ${current}`
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "symlink",
        path: relativePath,
        status: "create",
        reason: "symlink is absent",
        linkTarget
      };
    }
    return {
      kind: "symlink",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect symlink: ${errorMessage(error)}`
    };
  }
}
function skillsForProfile(profile) {
  return [...COMMON_SKILLS, ...PROFILE_SKILLS[profile]].sort();
}
function normalizeRelative(path) {
  const normalized = path.split(sep2).join("/");
  return normalized === "." ? normalized : normalized.replace(/^\.\//, "");
}
function sortOperations(operations) {
  const kindOrder = {
    directory: 0,
    file: 1,
    "managed-block": 2,
    symlink: 3
  };
  return operations.sort(
    (left, right) => kindOrder[left.kind] - kindOrder[right.kind] || left.path.localeCompare(right.path)
  );
}

// src/applier.ts
async function applyInstallPlan(plan) {
  const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to apply ${conflicts.length} conflict(s): ${conflicts.map((item) => item.path).join(", ")}`
    );
  }
  let changed = 0;
  for (const operation of plan.operations) {
    if (operation.status === "unchanged") {
      continue;
    }
    await assertExpectedState(plan.target, operation);
    await applyOperation(plan.target, operation);
    changed += 1;
  }
  const files = {};
  for (const operation of plan.operations) {
    if (operation.track && operation.content !== void 0) {
      files[operation.path] = { sha256: hashContent(operation.content) };
    }
  }
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    installedVersion: WORKFLOW_VERSION,
    profile: plan.profile,
    files
  };
  const statePath = join3(plan.target, ".workflow/state.json");
  await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}
`);
  return { changed, statePath };
}
async function applyOperation(target, operation) {
  const absolute = join3(target, operation.path);
  if (operation.kind === "directory") {
    await mkdir(absolute, { recursive: true });
    return;
  }
  if (operation.kind === "symlink") {
    if (!operation.linkTarget) {
      throw new Error(`Missing symlink target for ${operation.path}`);
    }
    await mkdir(dirname2(absolute), { recursive: true });
    await symlink(operation.linkTarget, absolute);
    return;
  }
  if (operation.content === void 0) {
    throw new Error(`Missing content for ${operation.path}`);
  }
  await writeAtomic(absolute, operation.content);
}
async function assertExpectedState(target, operation) {
  const absolute = join3(target, operation.path);
  if (operation.status === "create") {
    try {
      await lstat2(absolute);
      throw new Error(`${operation.path} appeared after planning`);
    } catch (error) {
      if (isMissing(error)) {
        return;
      }
      throw error;
    }
  }
  if (operation.expectedHash) {
    const current = await readFile4(absolute);
    if (hashContent(current) !== operation.expectedHash) {
      throw new Error(`${operation.path} changed after planning`);
    }
  }
}
async function writeAtomic(path, content) {
  await mkdir(dirname2(path), { recursive: true });
  const temporary = join3(dirname2(path), `.wfctl-${randomUUID()}.tmp`);
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}
function isMissing(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

// src/bootstrap.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import {
  lstat as lstat3,
  mkdir as mkdir2,
  readFile as readFile5,
  rename as rename2,
  writeFile as writeFile2
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname as dirname3, join as join4, resolve as resolve4 } from "node:path";
var SETUP_SKILL = "setup-workflow-environment";
async function buildBootstrapPlan(options) {
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const sourceRoot = join4(distributionRoot, "skills", SETUP_SKILL);
  const sourceFiles = await collectFiles(sourceRoot);
  if (sourceFiles.length === 0) {
    throw new Error(`Bootstrap skill is missing from distribution: ${sourceRoot}`);
  }
  const targets = bootstrapTargets(options);
  const operations = [];
  for (const target of targets) {
    const state = await readBootstrapState(target.statePath);
    for (const relativePath of sourceFiles) {
      const content = await readFile5(join4(sourceRoot, relativePath), "utf8");
      operations.push(await planBootstrapFile(target, relativePath, content, state));
    }
  }
  return {
    agent: options.agent,
    targets,
    operations: operations.sort(
      (left, right) => left.agent.localeCompare(right.agent) || left.path.localeCompare(right.path)
    )
  };
}
async function applyBootstrapPlan(plan) {
  const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to apply ${conflicts.length} bootstrap conflict(s): ${conflicts.map((operation) => operation.path).join(", ")}`
    );
  }
  let changed = 0;
  for (const operation of plan.operations) {
    if (operation.status === "unchanged") {
      continue;
    }
    await assertExpectedState2(operation);
    await writeAtomic2(operation.path, operation.content ?? "");
    changed += 1;
  }
  const statePaths = [];
  for (const target of plan.targets) {
    const files = {};
    for (const operation of plan.operations) {
      if (operation.agent === target.agent && operation.content !== void 0) {
        files[operation.relativePath] = { sha256: hashContent(operation.content) };
      }
    }
    const state = {
      schemaVersion: 1,
      installedVersion: WORKFLOW_VERSION,
      files
    };
    await writeAtomic2(target.statePath, `${JSON.stringify(state, null, 2)}
`);
    statePaths.push(target.statePath);
  }
  return { changed, statePaths };
}
function summarizeBootstrapPlan(plan) {
  const counts = Object.fromEntries(
    ["create", "update", "unchanged", "conflict"].map((status) => [
      status,
      plan.operations.filter((operation) => operation.status === status).length
    ])
  );
  return {
    agent: plan.agent,
    targets: plan.targets.map(({ agent, skillsRoot, skillRoot }) => ({
      agent,
      skillsRoot,
      skillRoot
    })),
    counts,
    operations: plan.operations.map(
      ({ content: _content, expectedHash: _expectedHash, ...operation }) => operation
    )
  };
}
function bootstrapTargets(options) {
  const requested = options.agent === "both" ? ["codex", "claude"] : [options.agent];
  return requested.map((agent) => {
    const configured = agent === "codex" ? options.codexSkillsRoot : options.claudeSkillsRoot;
    const defaultRoot = agent === "codex" ? join4(homedir(), ".agents/skills") : join4(homedir(), ".claude/skills");
    const skillsRoot = resolve4(configured ?? defaultRoot);
    const skillRoot = join4(skillsRoot, SETUP_SKILL);
    return {
      agent,
      skillsRoot,
      skillRoot,
      statePath: join4(skillRoot, ".wfctl-state.json")
    };
  });
}
async function planBootstrapFile(target, relativePath, content, state) {
  const path = join4(target.skillRoot, relativePath);
  const desiredHash = hashContent(content);
  try {
    const stat = await lstat3(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "conflict",
        reason: "destination exists and is not a regular file"
      };
    }
    const currentHash = hashContent(await readFile5(path));
    if (currentHash === desiredHash) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "unchanged",
        reason: "bootstrap skill file is current",
        content,
        expectedHash: currentHash
      };
    }
    const installedHash = state?.files[relativePath]?.sha256;
    if (installedHash && installedHash === currentHash) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "update",
        reason: "managed bootstrap skill file matches the installed version",
        content,
        expectedHash: currentHash
      };
    }
    return {
      agent: target.agent,
      path,
      relativePath,
      status: "conflict",
      reason: installedHash ? "managed bootstrap skill file was locally modified" : "destination exists without wfctl ownership"
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "create",
        reason: "bootstrap skill file is absent",
        content
      };
    }
    return {
      agent: target.agent,
      path,
      relativePath,
      status: "conflict",
      reason: `cannot inspect bootstrap skill file: ${errorMessage(error)}`
    };
  }
}
async function readBootstrapState(path) {
  try {
    const parsed = JSON.parse(await readFile5(path, "utf8"));
    if (parsed.schemaVersion !== 1 || !parsed.files) {
      throw new Error("invalid state shape");
    }
    return parsed;
  } catch (error) {
    if (isMissingFileError(error)) {
      return void 0;
    }
    throw new Error(`Cannot read bootstrap state ${path}: ${errorMessage(error)}`);
  }
}
async function assertExpectedState2(operation) {
  if (operation.status === "create") {
    try {
      await lstat3(operation.path);
      throw new Error(`${operation.path} appeared after planning`);
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }
      throw error;
    }
  }
  if (operation.expectedHash) {
    const currentHash = hashContent(await readFile5(operation.path));
    if (currentHash !== operation.expectedHash) {
      throw new Error(`${operation.path} changed after planning`);
    }
  }
}
async function writeAtomic2(path, content) {
  await mkdir2(dirname3(path), { recursive: true });
  const temporary = join4(dirname3(path), `.wfctl-${randomUUID2()}.tmp`);
  await writeFile2(temporary, content, "utf8");
  await rename2(temporary, path);
}

// src/doctor.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { access as access2 } from "node:fs/promises";
import { constants as constants2 } from "node:fs";
import { join as join5, resolve as resolve6 } from "node:path";

// src/git.ts
import { spawnSync } from "node:child_process";
import { basename, resolve as resolve5 } from "node:path";
function readRepositoryMetadata(root) {
  const topLevel = git(root, ["rev-parse", "--show-toplevel"], true);
  const gitDirRaw = git(root, ["rev-parse", "--git-dir"], true);
  const commonDirRaw = git(root, ["rev-parse", "--git-common-dir"], true);
  const branch = git(root, ["symbolic-ref", "--short", "-q", "HEAD"]) || "DETACHED";
  const commit = git(root, ["rev-parse", "HEAD"]) || "unknown";
  const remote = git(root, ["config", "--get", "remote.origin.url"]);
  const gitDir = resolve5(topLevel, gitDirRaw);
  const commonDir = resolve5(topLevel, commonDirRaw);
  return {
    repository: repositoryId(remote, commonDir),
    checkout: basename(topLevel),
    branch,
    commit,
    remote,
    worktree: gitDir !== commonDir
  };
}
function isGitRepository(root) {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 && result.stdout.trim() === "true";
}
function git(root, args, required = false) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    if (required) {
      const detail = result.stderr.trim() || args.join(" ");
      throw new Error(`Git metadata unavailable: ${detail}`);
    }
    return "";
  }
  return result.stdout.trim();
}
function repositoryId(remote, commonDir) {
  if (remote) {
    const normalized = remote.replace(/\/+$/, "").replace(/\.git$/, "");
    const match = normalized.match(/([^/:]+\/[^/]+)$/);
    if (match?.[1]) {
      return match[1].replace(/[^a-zA-Z0-9._/-]/g, "-");
    }
  }
  const parent = commonDir.endsWith("/.git") ? commonDir.slice(0, -5) : commonDir;
  return basename(parent);
}

// src/doctor.ts
async function runDoctor(targetInput, options = {}) {
  const target = resolve6(targetInput);
  const checks = [];
  let config;
  try {
    config = await readConfig(target);
    checks.push({ name: "config", status: "pass", message: `${config.profile} profile` });
  } catch (error) {
    checks.push({ name: "config", status: "fail", message: errorMessage(error) });
    return { target, checks };
  }
  const gitRepository = isGitRepository(target);
  checks.push({
    name: "git",
    status: gitRepository ? "pass" : "fail",
    message: gitRepository ? "Git repository detected" : "Target is not a Git worktree"
  });
  const graphifyAvailable = options.graphifyAvailable ?? spawnSync2("graphify", ["--version"], { stdio: "ignore" }).status === 0;
  checks.push({
    name: "graphify-cli",
    status: graphifyAvailable ? "pass" : "fail",
    message: graphifyAvailable ? "Graphify is available" : "Graphify is not available"
  });
  checks.push(await pathCheck(
    "graphify-graph",
    join5(target, "graphify-out/graph.json"),
    "warn",
    "Graphify graph is ready",
    "Graphify graph has not been built"
  ));
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  checks.push(await pathCheck(
    "knowledge",
    join5(knowledgeRoot, "knowledge/index.md"),
    "fail",
    `Knowledge bundle found at ${knowledgeRoot}`,
    `Knowledge bundle is missing at ${knowledgeRoot}`
  ));
  if (config.profile === "knowledge") {
    for (const directory of ["raw", "changes/active", "changes/archive"]) {
      checks.push(await pathCheck(
        `knowledge-${directory}`,
        join5(target, directory),
        "fail",
        `${directory} exists`,
        `${directory} is missing`
      ));
    }
  }
  try {
    const plan = await buildInstallPlan({
      target,
      profile: config.profile,
      ...config.profile === "leaf" ? { knowledge: knowledgeRoot } : {}
    });
    const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
    const pending = plan.operations.filter(
      (operation) => operation.status === "create" || operation.status === "update"
    );
    if (conflicts.length > 0) {
      checks.push({
        name: "installation",
        status: "fail",
        message: `${conflicts.length} workflow conflict(s)`
      });
    } else if (pending.length > 0) {
      checks.push({
        name: "installation",
        status: "warn",
        message: `${pending.length} workflow update(s) pending`
      });
    } else {
      checks.push({
        name: "installation",
        status: "pass",
        message: "Workflow assets are current"
      });
    }
  } catch (error) {
    checks.push({ name: "installation", status: "fail", message: errorMessage(error) });
  }
  return { target, profile: config.profile, checks };
}
function doctorPassed(report) {
  return report.checks.every((check) => check.status !== "fail");
}
async function pathCheck(name, path, missingStatus, presentMessage, missingMessage) {
  try {
    await access2(path, constants2.F_OK);
    return { name, status: "pass", message: presentMessage };
  } catch {
    return { name, status: missingStatus, message: missingMessage };
  }
}

// src/work.ts
import { access as access3, mkdir as mkdir3, readFile as readFile6, rename as rename3, unlink, writeFile as writeFile3 } from "node:fs/promises";
import { constants as constants3 } from "node:fs";
import { dirname as dirname4, join as join6, resolve as resolve7, sep as sep3 } from "node:path";

// node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

// node_modules/yaml/browser/dist/visit.js
var BREAK = /* @__PURE__ */ Symbol("break visit");
var SKIP = /* @__PURE__ */ Symbol("skip children");
var REMOVE = /* @__PURE__ */ Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
  const ctrl = callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visit_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = visit_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = visit_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
  const ctrl = await callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visitAsync_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = await visitAsync_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key, node, visitor, path) {
  if (typeof visitor === "function")
    return visitor(key, node, path);
  if (isMap(node))
    return visitor.Map?.(key, node, path);
  if (isSeq(node))
    return visitor.Seq?.(key, node, path);
  if (isPair(node))
    return visitor.Pair?.(key, node, path);
  if (isScalar(node))
    return visitor.Scalar?.(key, node, path);
  if (isAlias(node))
    return visitor.Alias?.(key, node, path);
  return void 0;
}
function replaceNode(key, path, node) {
  const parent = path[path.length - 1];
  if (isCollection(parent)) {
    parent.items[key] = node;
  } else if (isPair(parent)) {
    if (key === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt} parent`);
  }
}

// node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line.trim().split(/[ \t]+/);
    const name = parts.shift();
    switch (name) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version] = parts;
        if (version === "1.1" || version === "1.2") {
          this.yaml.version = version;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version);
          onError(6, `Unsupported YAML version ${version}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error) {
        onError(String(error));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags[node.tag] = true;
      });
      tagNames = Object.keys(tags);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

// node_modules/yaml/browser/dist/doc/anchors.js
function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name = `${prefix}${i}`;
    if (!exclude.has(name))
      return name;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error = new Error("Failed to resolve repeated object (this should not happen)");
          error.source = source;
          throw error;
        }
      }
    },
    sourceObjects
  };
}

// node_modules/yaml/browser/dist/doc/applyReviver.js
function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v0)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v0)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === void 0)
          val.delete(v0);
        else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v0)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key, val);
}

// node_modules/yaml/browser/dist/nodes/toJS.js
function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v, i) => toJS(v, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data2 = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data2);
    ctx.onCreate = (res2) => {
      data2.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

// node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count: count2, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count2);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

// node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    if (ctx?.maxAliasCount === 0)
      throw new ReferenceError("Alias resolution is disabled");
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const { anchors, doc, maxAliasCount } = ctx;
    const source = this.resolve(doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    let data2 = anchors.get(source);
    if (!data2) {
      toJS(source, null, ctx);
      data2 = anchors.get(source);
    }
    if (data2?.res === void 0) {
      const msg = "This should not happen: Alias anchor was not resolved?";
      throw new ReferenceError(msg);
    }
    if (maxAliasCount >= 0) {
      data2.count += 1;
      if (data2.aliasCount === 0)
        data2.aliasCount = getAliasCount(doc, source, anchors);
      if (data2.count * data2.aliasCount > maxAliasCount) {
        const msg = "Excessive alias count indicates a resource exhaustion attack";
        throw new ReferenceError(msg);
      }
    }
    return data2.res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count2 = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count2)
        count2 = c;
    }
    return count2;
  } else if (isPair(node)) {
    const kc = getAliasCount(doc, node.key, anchors);
    const vc = getAliasCount(doc, node.value, anchors);
    return Math.max(kc, vc);
  }
  return 1;
}

// node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

// node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter((t) => t.tag === tagName);
    const tagObj = match.find((t) => !t.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map2.items.push(value);
    return map2;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

// node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema4, path, value) {
  let v = value;
  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      v = /* @__PURE__ */ new Map([[k, v]]);
    }
  }
  return createNode(v, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path, value) {
    if (isEmptyPath(path))
      this.add(value);
    else {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.delete(key);
    const node = this.get(key, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    const [key, ...rest] = path;
    const node = this.get(key, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.has(key);
    const node = this.get(key, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    const [key, ...rest] = path;
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyComment.js
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
  if (/^\n+$/.test(comment))
    return comment.substring(1);
  return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

// node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep)
    return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text, i, indent.length);
      end = i + indent.length + endStep;
      split = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split = i;
      }
      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text;
  if (onFold)
    onFold();
  let res = text.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text.length;
    if (fold === 0)
      res = `
${indent}${text.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text[fold]}\\`;
      res += `
${indent}${text.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text[++i];
    } else {
      do {
        ch = text[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text[start];
    }
  }
  return end;
}

// node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code2 = json.substr(i + 2, 4);
            switch (code2) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code2.substr(0, 2) === "00")
                  str += "\\x" + code2.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs;
  if (singleQuote === false)
    qs = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs = doubleQuotedString;
    else
      qs = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header = (startWithSpace ? indentSize : "") + chomp;
  if (comment) {
    header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags } = ctx.doc.schema;
    if (tags.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t);
    if (res === null)
      throw new Error(`Unsupported default string type ${t}`);
  }
  return res;
}

// node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trailingComma: false,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags, item) {
  if (item.tag) {
    const match = tags.filter((t) => t.tag === item.tag);
    if (match.length > 0)
      return match.find((t) => t.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags.filter((t) => t.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t) => t.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
  } else {
    obj = item;
    tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
  }
  if (!tagObj) {
    const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

// node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key) && key.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key) || !isNode(key) && typeof key === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws = " ";
  if (keyComment || vsb || vcb) {
    ws = vsb ? "\n" : "";
    if (vcb) {
      const cs = commentString(vcb);
      ws += `
${indentComment(cs, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws === "\n" && valueComment)
        ws = "\n\n";
    } else {
      ws += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws = "";
  }
  str += ws + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

// node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

// node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (isSeq(source))
    for (const it of source.items)
      mergeValue(ctx, map2, it);
  else if (Array.isArray(source))
    for (const it of source)
      mergeValue(ctx, map2, it);
  else
    mergeValue(ctx, map2, source);
}
function mergeValue(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key, value2] of srcMap) {
    if (map2 instanceof Map) {
      if (!map2.has(key))
        map2.set(key, value2);
    } else if (map2 instanceof Set) {
      map2.add(key);
    } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
      Object.defineProperty(map2, key, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map2;
}
function resolveAliasValue(ctx, value) {
  return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

// node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map2, { key, value }) {
  if (isNode(key) && key.addToJSMap)
    key.addToJSMap(ctx, map2, value);
  else if (isMergeKey(ctx, key))
    addMergeToJSMap(ctx, map2, value);
  else {
    const jsKey = toJS(key, "", ctx);
    if (map2 instanceof Map) {
      map2.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map2 instanceof Set) {
      map2.add(jsKey);
    } else {
      const stringKey = stringifyKey(key, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map2)
        Object.defineProperty(map2, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map2[stringKey] = jsValue;
    }
  }
  return map2;
}
function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

// node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key, value, ctx) {
  const k = createNode(key, void 0, ctx);
  const v = createNode(value, void 0, ctx);
  return new Pair(k, v);
}
var Pair = class _Pair {
  constructor(key, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key;
    this.value = value;
  }
  clone(schema4) {
    let { key, value } = this;
    if (isNode(key))
      key = key.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
    if (comment2)
      str2 += lineComment(str2, itemIndent, commentString(comment2));
    if (chompKeep && comment2)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      str += line ? `
${indent}${line}` : "\n";
    }
  }
  if (comment) {
    str += "\n" + indentComment(commentString(comment), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment = ik.comment;
      }
    }
    if (comment)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment = null);
    reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
    if (i < items.length - 1) {
      str += ",";
    } else if (ctx.options.trailingComma) {
      if (ctx.options.lineWidth > 0) {
        reqNewline || (reqNewline = lines.reduce((sum2, line) => sum2 + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
      }
      if (reqNewline) {
        str += ",";
      }
    }
    if (comment)
      str += lineComment(str, itemIndent, commentString(comment));
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum2, line) => sum2 + line.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line of lines)
        str += line ? `
${indentStep}${indent}${line}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
  if (comment && chompKeep)
    comment = comment.replace(/^\n+/, "");
  if (comment) {
    const ic = indentComment(commentString(comment), indent);
    lines.push(ic.trimStart());
  }
}

// node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key) {
  const k = isScalar(key) ? key.value : key;
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key || it.key === k)
        return it;
      if (isScalar(it.key) && it.key.value === k)
        return it;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map2 = new this(schema4);
    const add = (key, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key, value);
      else if (Array.isArray(replacer) && !replacer.includes(key))
        return;
      if (value !== void 0 || keepUndefined)
        map2.items.push(createPair(key, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key, value] of obj)
        add(key, value);
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj))
        add(key, obj[key]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map2.items.sort(schema4.sortMapEntries);
    }
    return map2;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key) {
    const it = findPair(this.items, key);
    if (!it)
      return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const it = findPair(this.items, key);
    const node = it?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key) {
    return !!findPair(this.items, key);
  }
  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type2) {
    const map2 = Type2 ? new Type2() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const item of this.items)
      addPairToJSMap(ctx, map2, item);
    return map2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

// node_modules/yaml/browser/dist/schema/common/map.js
var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map2, onError) {
    if (!isMap(map2))
      onError("Expected a mapping for this tag");
    return map2;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return void 0;
    const it = this.items[idx];
    return !keepScalar && isScalar(it) ? it.value : it;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it of obj) {
        if (typeof replacer === "function") {
          const key = obj instanceof Set ? it : String(i++);
          it = replacer.call(obj, key, it);
        }
        seq2.items.push(createNode(it, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key) {
  let idx = isScalar(key) ? key.value : key;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

// node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/schema/common/string.js
var string2 = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

// node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

// node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/core/schema.js
var schema = [
  map,
  seq,
  string2,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

// node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

// node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn = pair.value ?? pair.key;
          cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it of iterable) {
      if (typeof replacer === "function")
        it = replacer.call(iterable, String(i++), it);
      let key, value;
      if (Array.isArray(it)) {
        if (it.length === 2) {
          key = it[0];
          value = it[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);
        if (keys.length === 1) {
          key = keys[0];
          value = it[key];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key = it;
      }
      pairs2.items.push(createPair(key, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map2 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const pair of this.items) {
      let key, value;
      if (isPair(pair)) {
        key = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, "", ctx);
      }
      if (map2.has(key))
        throw new Error("Ordered maps must not include duplicate keys");
      map2.set(key, value);
    }
    return map2;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key } of pairs2.items) {
      if (isScalar(key)) {
        if (seenKeys.includes(key.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key.value}`);
        } else {
          seenKeys.push(key.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key) {
    let pair;
    if (isPair(key))
      pair = key;
    else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
      pair = new Pair(key.key, null);
    else
      pair = new Pair(key, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map2, onError) {
    if (isMap(map2)) {
      if (map2.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map2);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map2;
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema3 = [
  map,
  seq,
  string2,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

// node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string2]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags = schemaTags;
  if (!tags) {
    if (Array.isArray(customTags))
      tags = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags = tags.concat(tag);
  } else if (typeof customTags === "function") {
    tags = customTags(tags.slice());
  }
  if (addMergeTag)
    tags = tags.concat(merge);
  return tags.reduce((tags2, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags2.includes(tagObj))
      tags2.push(tagObj);
    return tags2;
  }, []);
}

// node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string2 });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs = commentString(doc.comment);
      if (cs.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs, ""));
      } else {
        lines.push(`... ${cs}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc = doc.comment;
    if (dc && chompKeep)
      dc = dc.replace(/^\n+/, "");
    if (dc) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc), ""));
    }
  }
  return lines.join("\n") + "\n";
}

// node_modules/yaml/browser/dist/doc/Document.js
var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version });
    this.setSchema(version, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key, value, options = {}) {
    const k = this.createNode(key, null, options);
    const v = this.createNode(value, null, options);
    return new Pair(k, v);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    return assertCollection(this.contents) ? this.contents.delete(key) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    if (isEmptyPath(path))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key) {
    return isCollection(this.contents) ? this.contents.has(key) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path) {
    if (isEmptyPath(path))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    if (isEmptyPath(path)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version, options = {}) {
    if (typeof version === "number")
      version = String(version);
    let opt;
    switch (version) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version;
        else
          this.directives = new Directives({ version });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count: count2, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count2);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

// node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
  constructor(name, pos, code2, message) {
    super();
    this.name = name;
    this.code = code2;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLParseError", pos, code2, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLWarning", pos, code2, message);
  }
};
var prettifyError = (src, lc) => (error) => {
  if (error.pos[0] === -1)
    return;
  error.linePos = error.pos.map((pos) => lc.linePos(pos));
  const { line, col } = error.linePos[0];
  error.message += ` at line ${line}, column ${col}`;
  let ci = col - 1;
  let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
  if (ci >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci - 39, lineStr.length - 79);
    lineStr = "\u2026" + lineStr.substring(trimStart);
    ci -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "\u2026";
  if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
    let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "\u2026\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count2 = 1;
    const end = error.linePos[1];
    if (end?.line === line && end.col > col) {
      count2 = Math.max(1, Math.min(end.col - col, 80 - ci));
    }
    const pointer = " ".repeat(ci) + "^".repeat(count2);
    error.message += `:

${lineStr}
${pointer}
`;
  }
};

// node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment)
          comment = cb;
        else
          comment += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment)
            comment += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      // else fallthrough
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

// node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key) {
  if (!key)
    return null;
  switch (key.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key.source.includes("\n"))
        return true;
      if (key.end) {
        for (const st of key.end)
          if (st.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it of key.items) {
        for (const st of it.start)
          if (st.type === "newline")
            return true;
        if (it.sep) {
          for (const st of it.sep)
            if (st.type === "newline")
              return true;
        }
        if (containsNewline(it.key) || containsNewline(it.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

// node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc, onError) {
  if (fc?.type === "flow-collection") {
    const end = fc.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

// node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

// node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key, sep: sep4, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key ?? sep4?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key) {
        if (key.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key && key.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep4) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map2.comment)
            map2.comment += "\n" + keyProps.comment;
          else
            map2.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key)) {
        onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map2.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep4 ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key || key.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep4, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map2.range = [bm.offset, offset, commentEnd ?? offset];
  return map2;
}

// node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs.offset;
  let commentEnd = null;
  for (const { start, value } of bs.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs.offset, offset, commentEnd ?? offset];
  return seq2;
}

// node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
  let comment = "";
  if (end) {
    let hasSpace = false;
    let sep4 = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += sep4 + cb;
          sep4 = "";
          break;
        }
        case "newline":
          if (comment)
            sep4 += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment, offset };
}

// node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
  const isMap2 = fc.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc.offset + fc.start.source.length;
  for (let i = 0; i < fc.items.length; ++i) {
    const collItem = fc.items[i];
    const { start, key, sep: sep4, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key ?? sep4?.[0],
      offset,
      onError,
      parentIndent: fc.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep4 && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key))
        onError(
          key,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st of start) {
          switch (st.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep4 && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep4, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep4 ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep4)
            for (const st of sep4) {
              if (st === valueProps.found)
                break;
              if (st.type === "newline") {
                onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep4, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map2 = coll;
        if (mapIncludes(ctx, map2.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map2.items.push(pair);
      } else {
        const map2 = new YAMLMap(ctx.schema);
        map2.flow = true;
        map2.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map2.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map2);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce, ...ee] = fc.end;
  let cePos = offset;
  if (ce?.source === expectedEnd)
    cePos = ce.offset + ce.source.length;
  else {
    const name = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce && ce.source.length !== 1)
      ee.unshift(ce);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc.offset, cePos, end.offset];
  } else {
    coll.range = [fc.offset, cePos, cePos];
  }
  return coll;
}

// node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl || nl.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
  if (!tag) {
    const kt = ctx.schema.knownTags[tagName];
    if (kt?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
      tag = kt;
    } else {
      if (kt) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

// node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar, onError) {
  const start = scalar.offset;
  const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
  if (!header)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar.source ? splitLines(scalar.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content = lines[i][1];
    if (content === "" || content === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header.length;
    if (scalar.source)
      end2 += scalar.source.length;
    return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar.indent + header.indent;
  let offset = scalar.offset + header.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content] = lines[i];
    if (content === "" || content === "\r") {
      if (header.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep4 = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content] = lines[i];
    offset += indent.length + content.length + 1;
    const crlf = content[content.length - 1] === "\r";
    if (crlf)
      content = content.slice(0, -1);
    if (content && indent.length < trimIndent) {
      const src = header.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep4 + indent.slice(trimIndent) + content;
      sep4 = "\n";
    } else if (indent.length > trimIndent || content[0] === "	") {
      if (sep4 === " ")
        sep4 = "\n";
      else if (!prevMoreIndented && sep4 === "\n")
        sep4 = "\n\n";
      value += sep4 + indent.slice(trimIndent) + content;
      sep4 = "\n";
      prevMoreIndented = true;
    } else if (content === "") {
      if (sep4 === "\n")
        value += "\n";
      else
        sep4 = "\n";
    } else {
      value += sep4 + content;
      sep4 = " ";
      prevMoreIndented = false;
    }
  }
  switch (header.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header.length + scalar.source.length;
  return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error === -1)
        error = offset + i;
    }
  }
  if (error !== -1)
    onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      // fallthrough
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      /* istanbul ignore next should not happen */
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts = token.source;
        if (ts && typeof ts === "string")
          length += ts.length;
      }
    }
  }
  return { mode, indent, chomp, comment, length };
}
function splitLines(source) {
  const split = source.split(/\n( *)/);
  const first = split[0];
  const m = first.match(/^( *)/);
  const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split.length; i += 2)
    lines.push([split[i], split[i + 1]]);
  return lines;
}

// node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar, strict, onError) {
  const { offset, type, source, end } = scalar;
  let _type;
  let value;
  const _onError = (rel, code2, msg) => onError(offset + rel, code2, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    /* istanbul ignore next should not happen */
    default:
      onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re.comment,
    range: [offset, valueEnd, re.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    /* istanbul ignore next should not happen */
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return foldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return foldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function foldLines(source) {
  let first, line;
  try {
    first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
    line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
  } catch {
    first = /(.*?)[ \t]*\r?\n/sy;
    line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
  }
  let match = first.exec(source);
  if (!match)
    return source;
  let res = match[1];
  let sep4 = " ";
  let pos = first.lastIndex;
  line.lastIndex = pos;
  while (match = line.exec(source)) {
    if (match[1] === "") {
      if (sep4 === "\n")
        res += sep4;
      else
        sep4 = "\n";
    } else {
      res += sep4 + match[1];
      sep4 = " ";
    }
    pos = line.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep4 + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc = escapeCodes[next];
      if (cc)
        res += cc;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = next === "x" ? 2 : next === "u" ? 4 : 8;
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "\x85",
  // Unicode next line
  _: "\xA0",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc = source.substr(offset, length);
  const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
  const code2 = ok ? parseInt(cc, 16) : NaN;
  try {
    return String.fromCodePoint(code2);
  } catch {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
}

// node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar = isScalar(res) ? res : new Scalar(res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar = new Scalar(value);
  }
  scalar.range = range;
  scalar.source = value;
  if (type)
    scalar.type = type;
  if (tagName)
    scalar.tag = tagName;
  if (tag.format)
    scalar.format = tag.format;
  if (comment)
    scalar.comment = comment;
  return scalar;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt = schema4.knownTags[tagName];
  if (kt && !kt.collection) {
    schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
    return kt;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts = directives.tagString(tag.tag);
      const cs = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts} or ${cs}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

// node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st = before[i];
      switch (st.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st.source.length;
          continue;
      }
      st = before[++i];
      while (st?.type === "space") {
        offset += st.source.length;
        st = before[++i];
      }
      break;
    }
  }
  return offset;
}

// node_modules/yaml/browser/dist/compose/compose-node.js
var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      try {
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError(token, "RESOURCE_EXHAUSTION", message);
      }
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      isSrcToken = false;
    }
  }
  node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment;
    else
      node.commentBefore = comment;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    node.comment = comment;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re.offset];
  if (re.comment)
    alias.comment = re.comment;
  return alias;
}

// node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re = resolveEnd(end, contentEnd, false, onError);
  if (re.comment)
    doc.comment = re.comment;
  doc.range = [offset, contentEnd, re.offset];
  return doc;
}

// node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code2, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code2, message));
      else
        this.errors.push(new YAMLParseError(pos, code2, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment) {
      const dc = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
      } else if (afterEmptyLine || doc.directives.docStart || !dc) {
        doc.commentBefore = comment;
      } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
        let it = dc.items[0];
        if (isPair(it))
          it = it.key;
        const cb = it.commentBefore;
        it.commentBefore = cb ? `${comment}
${cb}` : comment;
      } else {
        const cb = dc.commentBefore;
        dc.commentBefore = cb ? `${comment}
${cb}` : comment;
      }
    }
    if (afterDoc) {
      for (let i = 0; i < this.errors.length; ++i)
        doc.errors.push(this.errors[i]);
      for (let i = 0; i < this.warnings.length; ++i)
        doc.warnings.push(this.warnings[i]);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error);
        else
          this.doc.errors.push(error);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc = this.doc.comment;
          this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

// node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK2 = /* @__PURE__ */ Symbol("break visit");
var SKIP2 = /* @__PURE__ */ Symbol("skip children");
var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path) => {
  let item = cst;
  for (const [field, index] of path) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path) => {
  const parent = visit2.itemAtPath(cst, path.slice(0, -1));
  const field = path[path.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
  let ctrl = visitor(item, path);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK2)
          return BREAK2;
        else if (ci === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}

// node_modules/yaml/browser/dist/parse/cst.js
var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

// node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt = this.buffer.substr(offset, 3);
      if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line = this.getLine();
    if (line === null)
      return this.setNext("stream");
    if (line[0] === BOM) {
      yield* this.pushCount(1);
      line = line.substring(1);
    }
    if (line[0] === "%") {
      let dirEnd = line.length;
      let cs = line.indexOf("#");
      while (cs !== -1) {
        const ch = line[cs - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs - 1;
          break;
        } else {
          cs = line.indexOf("#", cs + 1);
        }
      }
      while (true) {
        const ch = line[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return "block-start";
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line = this.getLine();
    if (line === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line[n]) {
      case "#":
        yield* this.pushCount(line.length - n);
      // fallthrough
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl, sp;
    let indent = -1;
    do {
      nl = yield* this.pushNewline();
      if (nl > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl + sp > 0);
    const line = this.getLine();
    if (line === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      // fallthrough
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl = qb.indexOf("\n", this.pos);
    if (nl !== -1) {
      while (nl !== -1) {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = qb.indexOf("\n", cs);
      }
      if (nl !== -1) {
        end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        // fallthrough
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = this.buffer.indexOf("\n", cs);
      } while (nl !== -1);
      if (nl === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl = this.buffer.length;
      }
    }
    let i = nl + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs = this.continueScalar(i + 1);
          if (cs === -1)
            break;
          i = Math.max(i, cs - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    let n = 0;
    loop: while (true) {
      switch (this.charAt(0)) {
        case "!":
          n += yield* this.pushTag();
          n += yield* this.pushSpaces(true);
          continue loop;
        case "&":
          n += yield* this.pushUntil(isNotAnchorChar);
          n += yield* this.pushSpaces(true);
          continue loop;
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            continue loop;
          }
        }
      }
      break loop;
    }
    return n;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

// node_modules/yaml/browser/dist/parse/line-counter.js
var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

// node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list, type) {
  for (let i = 0; i < list.length; ++i)
    if (list[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list) {
  for (let i = 0; i < list.length; ++i) {
    switch (list[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it = parent.items[parent.items.length - 1];
      return it.sep ?? it.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    /* istanbul ignore next should not happen */
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
  if (source.length < 1e5)
    Array.prototype.push.apply(target, source);
  else
    for (let i = 0; i < source.length; ++i)
      target.push(source[i]);
}
function fixFlowSeqItems(fc) {
  if (fc.start.type === "flow-seq-start") {
    for (const it of fc.items) {
      if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
        if (it.key)
          it.value = it.key;
        delete it.key;
        if (isFlowToken(it.value)) {
          if (it.value.end)
            arrayPushArray(it.value.end, it.sep);
          else
            it.value.end = it.sep;
        } else
          arrayPushArray(it.start, it.sep);
        delete it.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error) {
    const token = error ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it = top.items[top.items.length - 1];
          if (it.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it.sep) {
            it.value = token;
          } else {
            Object.assign(it, { key: token, sep: [] });
            this.onKeyLine = !it.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it = top.items[top.items.length - 1];
          if (it.value)
            top.items.push({ start: [], value: token });
          else
            it.value = token;
          break;
        }
        case "flow-collection": {
          const it = top.items[top.items.length - 1];
          if (!it || it.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it.sep)
            it.value = token;
          else
            Object.assign(it, { key: token, sep: [] });
          return;
        }
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep4;
      if (scalar.end) {
        sep4 = scalar.end;
        sep4.push(this.sourceToken);
        delete scalar.end;
      } else
        sep4 = [this.sourceToken];
      const map2 = {
        type: "block-map",
        offset: scalar.offset,
        indent: scalar.indent,
        items: [{ start, key: scalar, sep: sep4 }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map2;
    } else
      yield* this.lineEnd(scalar);
  }
  *blockScalar(scalar) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        yield* this.pop();
        break;
      /* istanbul ignore next should not happen */
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map2) {
    const it = map2.items[map2.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          it.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it.value) {
          map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it.start, map2.indent)) {
            const prev = map2.items[map2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              map2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map2.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
      const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it.sep && !it.value) {
        const nl = [];
        for (let i = 0; i < it.sep.length; ++i) {
          const st = it.sep[i];
          switch (st.type) {
            case "newline":
              nl.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st.indent > map2.indent)
                nl.length = 0;
              break;
            default:
              nl.length = 0;
          }
        }
        if (nl.length >= 2)
          start = it.sep.splice(nl[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start });
            this.onKeyLine = true;
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it.sep && !it.explicitKey) {
            it.start.push(this.sourceToken);
            it.explicitKey = true;
          } else if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it.explicitKey) {
            if (!it.sep) {
              if (includesToken(it.start, "newline")) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it.value) {
              map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it.start);
              const key = it.key;
              const sep4 = it.sep;
              sep4.push(this.sourceToken);
              delete it.key;
              delete it.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key, sep: sep4 }]
              });
            } else if (start.length > 0) {
              it.sep = it.sep.concat(start, this.sourceToken);
            } else {
              it.sep.push(this.sourceToken);
            }
          } else {
            if (!it.sep) {
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            } else if (it.value || atNextItem) {
              map2.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (atNextItem || it.value) {
            map2.items.push({ start, key: fs, sep: [] });
            this.onKeyLine = true;
          } else if (it.sep) {
            this.stack.push(fs);
          } else {
            Object.assign(it, { key: fs, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map2);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map2.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it.value || this.indent <= seq2.indent)
          break;
        it.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it.value || includesToken(it.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc) {
    const it = fc.items[fc.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it || it.sep)
            fc.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it || it.value)
            fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            Object.assign(it, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it || it.value)
            fc.items.push({ start: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            it.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (!it || it.value)
            fc.items.push({ start: [], key: fs, sep: [] });
          else if (it.sep)
            this.stack.push(fs);
          else
            Object.assign(it, { key: fs, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc);
        const sep4 = fc.end.splice(1, fc.end.length);
        sep4.push(this.sourceToken);
        const map2 = {
          type: "block-map",
          offset: fc.offset,
          indent: fc.indent,
          items: [{ start, key: fc, sep: sep4 }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else {
        yield* this.lineEnd(fc);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl = this.source.indexOf("\n") + 1;
      while (nl !== 0) {
        this.onNewLine(this.offset + nl);
        nl = this.source.indexOf("\n", nl) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st) => st.type === "newline" || st.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      // fallthrough
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

// node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}
function parse(src, reviver, options) {
  let _reviver = void 0;
  if (typeof reviver === "function") {
    _reviver = reviver;
  } else if (options === void 0 && reviver && typeof reviver === "object") {
    options = reviver;
  }
  const doc = parseDocument(src, options);
  if (!doc)
    return null;
  doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
  if (doc.errors.length > 0) {
    if (doc.options.logLevel !== "silent")
      throw doc.errors[0];
    else
      doc.errors = [];
  }
  return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify3(value, replacer, options) {
  let _replacer = null;
  if (typeof replacer === "function" || Array.isArray(replacer)) {
    _replacer = replacer;
  } else if (options === void 0 && replacer) {
    options = replacer;
  }
  if (typeof options === "string")
    options = options.length;
  if (typeof options === "number") {
    const indent = Math.round(options);
    options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
  }
  if (value === void 0) {
    const { keepUndefined } = options ?? replacer ?? {};
    if (!keepUndefined)
      return void 0;
  }
  if (isDocument(value) && !_replacer)
    return value.toString(options);
  return new Document(value, _replacer, options).toString(options);
}

// src/work-spec.ts
function parseWorkSpec(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error("Work spec must start with YAML frontmatter");
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    throw new Error("Work spec frontmatter is not closed");
  }
  const metadata = parse(lines.slice(1, end).join("\n"));
  if (!isRecord(metadata)) {
    throw new Error("Work spec frontmatter must be a mapping");
  }
  return {
    metadata,
    body: lines.slice(end + 1).join("\n").replace(/^\n/, "")
  };
}
function serializeWorkSpec(document) {
  return `---
${stringify3(document.metadata, { lineWidth: 0 }).trimEnd()}
---

${document.body.trimStart()}`;
}
function completionIssues(document, requireCompleted) {
  const issues = [];
  const metadata = document.metadata;
  const mode = stringValue(metadata.mode);
  const verification = recordValue(metadata.verification);
  const alignment = recordValue(metadata.knowledge_alignment);
  const graph = recordValue(metadata.graph_evidence);
  if (requireCompleted && metadata.status !== "completed") {
    issues.push("status must be completed");
  }
  if (/^\s*-\s+\[ \]/m.test(document.body)) {
    issues.push("unchecked plan or acceptance items remain");
  }
  if (!verification || verification.result !== "passed") {
    issues.push("verification.result must be passed");
  }
  if (verification?.acceptance_reviewed !== true) {
    issues.push("verification.acceptance_reviewed must be true");
  }
  if (verification?.implementation_reviewed !== true) {
    issues.push("verification.implementation_reviewed must be true");
  }
  if (!nonEmptyArray(verification?.checks)) {
    issues.push("verification.checks must contain fresh evidence");
  }
  if (!Array.isArray(verification?.unresolved) || verification.unresolved.length > 0) {
    issues.push("verification.unresolved must be an empty list");
  }
  if (mode !== "handoff") {
    if (!nonEmptyArray(alignment?.reviewed)) {
      issues.push("knowledge_alignment.reviewed must contain at least one concept");
    }
    if (!nonEmptyArray(graph?.queries)) {
      issues.push("graph_evidence.queries must contain at least one query");
    }
    if (!Array.isArray(alignment?.conflicts) || alignment.conflicts.length > 0) {
      issues.push("knowledge_alignment.conflicts must be resolved");
    }
  }
  return issues;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function recordValue(value) {
  return isRecord(value) ? value : void 0;
}
function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : "";
}

// src/work.ts
async function beginWork(options) {
  const target = resolve7(options.target);
  const config = await readConfig(target);
  if (config.profile !== "leaf") {
    throw new Error("Work records must be started from a leaf repository");
  }
  if (options.mode !== "handoff") {
    if (!options.knowledgeRef?.trim()) {
      throw new Error("Full and slice work require --knowledge-ref <path>");
    }
    if (!options.graphQuery?.trim()) {
      throw new Error("Full and slice work require --graph-query <query>");
    }
    await assertGraphReady(target);
  }
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  await assertKnowledgeRoot(knowledgeRoot);
  if (options.knowledgeRef) {
    await assertKnowledgeReference(knowledgeRoot, options.knowledgeRef);
  }
  const metadata = readRepositoryMetadata(target);
  const now = options.now ?? /* @__PURE__ */ new Date();
  const date = now.toISOString().slice(0, 10);
  const slug = normalizeSlug(options.slug);
  const id = await uniqueWorkId(join6(knowledgeRoot, "changes/active"), `${date}-${slug}`);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const templatePath = join6(
    distributionRoot,
    "skills/manage-project-work/assets/work-spec.md"
  );
  const template = parseWorkSpec(await readFile6(templatePath, "utf8"));
  const createdAt = now.toISOString();
  template.metadata = {
    ...template.metadata,
    id,
    title: options.title,
    mode: options.mode,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    source: metadata,
    knowledge_alignment: {
      reviewed: options.knowledgeRef ? [options.knowledgeRef] : [],
      conflicts: []
    },
    graph_evidence: {
      queries: options.graphQuery ? [options.graphQuery] : []
    }
  };
  const activeDirectory = join6(knowledgeRoot, "changes/active", id);
  const specPath = join6(activeDirectory, "SPEC.md");
  const pointerPath = join6(target, ".workflow/current", `${id}.json`);
  await mkdir3(activeDirectory, { recursive: false });
  await writeFile3(specPath, serializeWorkSpec(template), { encoding: "utf8", flag: "wx" });
  await mkdir3(dirname4(pointerPath), { recursive: true });
  await writeFile3(
    pointerPath,
    `${JSON.stringify({
      schemaVersion: 1,
      id,
      spec: portableRelative(target, specPath),
      createdAt
    }, null, 2)}
`,
    { encoding: "utf8", flag: "wx" }
  );
  return { id, specPath, pointerPath };
}
async function verifyWork(targetInput, id) {
  const target = resolve7(targetInput);
  const config = await readConfig(target);
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const specPath = join6(knowledgeRoot, "changes/active", id, "SPEC.md");
  const document = parseWorkSpec(await readFile6(specPath, "utf8"));
  return {
    id,
    specPath,
    issues: completionIssues(document, false)
  };
}
async function flushWork(options) {
  const target = resolve7(options.target);
  const config = await readConfig(target);
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const activeDirectory = join6(knowledgeRoot, "changes/active", options.id);
  const specPath = join6(activeDirectory, "SPEC.md");
  const document = parseWorkSpec(await readFile6(specPath, "utf8"));
  if (options.outcome === "completed") {
    const issues = completionIssues(document, true);
    if (issues.length > 0) {
      throw new Error(`Completed flush is blocked: ${issues.join("; ")}`);
    }
  }
  const archivePath = join6(knowledgeRoot, "changes/archive", options.id);
  await assertAbsent(archivePath, "archive");
  const now = options.now ?? /* @__PURE__ */ new Date();
  const metadata = readRepositoryMetadata(target);
  const rawDirectory = join6(
    knowledgeRoot,
    "raw",
    now.toISOString().slice(0, 4),
    now.toISOString().slice(5, 7)
  );
  const rawName = `${compactTimestamp(now)}--${safeName(metadata.repository)}--${safeName(options.id)}.md`;
  const rawPath = join6(rawDirectory, rawName);
  await assertAbsent(rawPath, "raw record");
  const raw = buildRawRecord(document, metadata, options.outcome, options.id, now);
  await mkdir3(rawDirectory, { recursive: true });
  await writeFile3(rawPath, raw, { encoding: "utf8", flag: "wx" });
  await mkdir3(dirname4(archivePath), { recursive: true });
  await rename3(activeDirectory, archivePath);
  await removePointer(join6(target, ".workflow/current", `${options.id}.json`));
  return { id: options.id, outcome: options.outcome, rawPath, archivePath };
}
function buildRawRecord(document, repository, outcome, id, now) {
  const title = typeof document.metadata.title === "string" ? document.metadata.title : id;
  const frontmatter = {
    type: "Work Record",
    title,
    description: `${outcome} project work from ${repository.repository}`,
    status: outcome === "completed" ? "stable" : outcome === "partial" ? "draft" : "deprecated",
    tags: ["workflow", "raw", outcome],
    generated: {
      by: `wfctl/${WORKFLOW_VERSION}`,
      at: now.toISOString()
    },
    sources: [
      {
        id: "source-repository",
        resource: repository.remote ? `${repository.remote}#${repository.commit}` : `repository:${repository.repository}@${repository.commit}`,
        title: repository.repository
      }
    ],
    workflow: {
      id,
      outcome,
      flushed_at: now.toISOString(),
      source: repository,
      spec: document.metadata
    }
  };
  return `---
${stringify3(frontmatter, { lineWidth: 0 }).trimEnd()}
---

${document.body.trimStart()}`;
}
async function assertGraphReady(target) {
  try {
    await access3(join6(target, "graphify-out/graph.json"), constants3.R_OK);
  } catch {
    throw new Error("Graphify graph is missing; build graphify-out/graph.json before starting work");
  }
}
async function assertKnowledgeRoot(root) {
  try {
    await access3(join6(root, "knowledge/index.md"), constants3.R_OK);
  } catch {
    throw new Error(`Knowledge repository is not initialized: ${root}`);
  }
}
async function assertKnowledgeReference(root, reference) {
  const normalized = reference.replace(/^\/+/, "");
  const absolute = resolve7(root, normalized);
  const boundary = `${resolve7(root)}${sep3}`;
  if (absolute !== resolve7(root) && !absolute.startsWith(boundary)) {
    throw new Error("Knowledge reference escapes the knowledge repository");
  }
  try {
    await access3(absolute, constants3.R_OK);
  } catch (error) {
    throw new Error(`Knowledge reference is not readable: ${reference} (${errorMessage(error)})`);
  }
}
async function uniqueWorkId(activeRoot, base) {
  for (let index = 1; index < 1e3; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    try {
      await access3(join6(activeRoot, candidate), constants3.F_OK);
    } catch {
      return candidate;
    }
  }
  throw new Error(`Cannot allocate a unique work id for ${base}`);
}
async function assertAbsent(path, label) {
  try {
    await access3(path, constants3.F_OK);
    throw new Error(`${label} already exists: ${path}`);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}
async function removePointer(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}
function normalizeSlug(value) {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Work slug must contain ASCII letters or digits");
  }
  return slug.slice(0, 64);
}
function compactTimestamp(value) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

// src/cli.ts
var main = new Command().name("wfctl").version(WORKFLOW_VERSION).description("Bootstrap and enforce a shared agent project workflow.").throwErrors().command("plan", installCommand("Show the exact installation plan.", false)).command("apply", installCommand("Apply a conflict-free installation plan.", true)).command("init", installCommand("Initialize a workflow environment.", true)).command("sync", syncCommand()).command("bootstrap", bootstrapCommand()).command("render", renderCommand()).command("doctor", doctorCommand()).command("work", workCommand());
try {
  await main.parse(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`wfctl: ${errorMessage(error)}
`);
  process.exitCode = 1;
}
function installCommand(description, apply) {
  return new Command().description(description).arguments("<profile:string>").option("-t, --target <path:string>", "Target repository.", { default: "." }).option("-k, --knowledge <path:string>", "Knowledge repository for a leaf profile.").option("--json", "Print machine-readable JSON.").action(async (options, profileValue) => {
    const profile = parseProfile(profileValue);
    const target = resolve8(options.target);
    const knowledge = options.knowledge ? resolve8(options.knowledge) : void 0;
    const plan = await buildInstallPlan({
      target,
      profile,
      ...knowledge ? { knowledge } : {}
    });
    if (!apply) {
      printPlan(plan, options.json === true);
      if (plan.operations.some((operation) => operation.status === "conflict")) {
        process.exitCode = 2;
      }
      return;
    }
    const result = await applyInstallPlan(plan);
    if (options.json) {
      printJson({ ...summarizePlan(plan), applied: result });
    } else {
      process.stdout.write(
        `Applied ${result.changed} change(s) to ${plan.target}
State: ${result.statePath}
`
      );
    }
  });
}
function syncCommand() {
  return new Command().description("Synchronize an existing workflow installation.").option("-t, --target <path:string>", "Target repository.", { default: "." }).option("--plan", "Show the plan without applying it.").option("--json", "Print machine-readable JSON.").action(async (options) => {
    const target = resolve8(options.target);
    const config = await readConfig(target);
    const knowledge = config.profile === "leaf" ? resolveKnowledgeRoot(target, config) : void 0;
    const plan = await buildInstallPlan({
      target,
      profile: config.profile,
      ...knowledge ? { knowledge } : {}
    });
    if (options.plan) {
      printPlan(plan, options.json === true);
      if (plan.operations.some((operation) => operation.status === "conflict")) {
        process.exitCode = 2;
      }
      return;
    }
    const result = await applyInstallPlan(plan);
    if (options.json) {
      printJson({ ...summarizePlan(plan), applied: result });
    } else {
      process.stdout.write(`Synchronized ${result.changed} change(s) in ${target}
`);
    }
  });
}
function bootstrapCommand() {
  return new Command().description("Install the user-level setup skill for clean repositories.").command("plan", bootstrapActionCommand(false)).command("install", bootstrapActionCommand(true));
}
function bootstrapActionCommand(apply) {
  return new Command().description(
    apply ? "Install or safely update the user-level setup skill." : "Show the user-level setup skill installation plan."
  ).option("--agent <agent:string>", "codex, claude, or both.", { default: "both" }).option("--codex-skills-root <path:string>", "Override the Codex user skills root.").option("--claude-skills-root <path:string>", "Override the Claude user skills root.").option("--json", "Print machine-readable JSON.").action(async (options) => {
    const plan = await buildBootstrapPlan({
      agent: parseBootstrapAgent(options.agent),
      ...options.codexSkillsRoot ? { codexSkillsRoot: resolve8(options.codexSkillsRoot) } : {},
      ...options.claudeSkillsRoot ? { claudeSkillsRoot: resolve8(options.claudeSkillsRoot) } : {}
    });
    if (!apply) {
      printBootstrapPlan(plan, options.json === true);
      if (plan.operations.some((operation) => operation.status === "conflict")) {
        process.exitCode = 2;
      }
      return;
    }
    const result = await applyBootstrapPlan(plan);
    if (options.json) {
      printJson({ ...summarizeBootstrapPlan(plan), applied: result });
    } else {
      process.stdout.write(
        `Installed bootstrap skill with ${result.changed} change(s)
${result.statePaths.map((path) => `State: ${path}`).join("\n")}
`
      );
    }
  });
}
function renderCommand() {
  return new Command().description("Render text for manual integration.").command(
    "agents",
    new Command().description("Render the wfctl AGENTS.md / CLAUDE.md managed block.").option("-p, --profile <profile:string>", "knowledge or leaf.", { required: true }).option("-t, --target <path:string>", "Target repository.", { default: "." }).option("-k, --knowledge <path:string>", "Knowledge repository for a leaf profile.").action(async (options) => {
      const profile = parseProfile(options.profile);
      const target = resolve8(options.target);
      const config = createConfig(
        profile,
        target,
        options.knowledge ? resolve8(options.knowledge) : void 0
      );
      const distributionRoot = await findDistributionRoot();
      const body = await renderAgentInstructions(
        distributionRoot,
        profile,
        config.knowledge?.path
      );
      process.stdout.write(`<!-- wfctl:begin -->
${body}
<!-- wfctl:end -->
`);
    })
  );
}
function doctorCommand() {
  return new Command().description("Diagnose a workflow installation.").option("-t, --target <path:string>", "Target repository.", { default: "." }).option("--json", "Print machine-readable JSON.").action(async (options) => {
    const report = await runDoctor(options.target);
    if (options.json) {
      printJson(report);
    } else {
      process.stdout.write(`Workflow doctor: ${report.target}
`);
      for (const check of report.checks) {
        process.stdout.write(`${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.message}
`);
      }
    }
    if (!doctorPassed(report)) {
      process.exitCode = 2;
    }
  });
}
function workCommand() {
  return new Command().description("Manage central project work records.").command(
    "begin",
    new Command().description("Create one canonical living spec in the knowledge repository.").arguments("<slug:string>").option("-t, --target <path:string>", "Leaf repository.", { default: "." }).option("--title <title:string>", "Human-readable work title.", { required: true }).option("--mode <mode:string>", "full, slice, or handoff.", { default: "full" }).option("--knowledge-ref <path:string>", "Reviewed curated knowledge concept.").option("--graph-query <query:string>", "Graphify query used before framing.").option("--json", "Print machine-readable JSON.").action(async (options, slug) => {
      const result = await beginWork({
        target: options.target,
        slug,
        title: options.title,
        mode: parseWorkMode(options.mode),
        ...options.knowledgeRef ? { knowledgeRef: options.knowledgeRef } : {},
        ...options.graphQuery ? { graphQuery: options.graphQuery } : {}
      });
      if (options.json) {
        printJson(result);
      } else {
        process.stdout.write(`Created ${result.id}
Spec: ${result.specPath}
`);
      }
    })
  ).command(
    "verify",
    new Command().description("Check the structural completion gate for a living spec.").arguments("<id:string>").option("-t, --target <path:string>", "Leaf repository.", { default: "." }).option("--json", "Print machine-readable JSON.").action(async (options, id) => {
      const result = await verifyWork(options.target, id);
      if (options.json) {
        printJson(result);
      } else if (result.issues.length === 0) {
        process.stdout.write(`Structural gate passed: ${result.specPath}
`);
      } else {
        process.stdout.write(`Structural gate failed: ${result.specPath}
`);
        for (const issue of result.issues) {
          process.stdout.write(`- ${issue}
`);
        }
      }
      if (result.issues.length > 0) {
        process.exitCode = 2;
      }
    })
  ).command(
    "flush",
    new Command().description("Archive a living spec and emit an immutable raw work record.").arguments("<id:string>").option("-t, --target <path:string>", "Leaf repository.", { default: "." }).option("--outcome <outcome:string>", "completed, partial, or abandoned.", {
      required: true
    }).option("--json", "Print machine-readable JSON.").action(async (options, id) => {
      const result = await flushWork({
        target: options.target,
        id,
        outcome: parseOutcome(options.outcome)
      });
      if (options.json) {
        printJson(result);
      } else {
        process.stdout.write(
          `Flushed ${result.id} as ${result.outcome}
Raw: ${result.rawPath}
Archive: ${result.archivePath}
`
        );
      }
    })
  );
}
function parseProfile(value) {
  if (value !== "knowledge" && value !== "leaf") {
    throw new Error(`Invalid profile "${value}"; expected knowledge or leaf`);
  }
  return value;
}
function parseBootstrapAgent(value) {
  if (value !== "codex" && value !== "claude" && value !== "both") {
    throw new Error(`Invalid agent "${value}"; expected codex, claude, or both`);
  }
  return value;
}
function parseWorkMode(value) {
  if (value !== "full" && value !== "slice" && value !== "handoff") {
    throw new Error(`Invalid mode "${value}"; expected full, slice, or handoff`);
  }
  return value;
}
function parseOutcome(value) {
  if (value !== "completed" && value !== "partial" && value !== "abandoned") {
    throw new Error(`Invalid outcome "${value}"; expected completed, partial, or abandoned`);
  }
  return value;
}
function printPlan(plan, json) {
  const summary = summarizePlan(plan);
  if (json) {
    printJson(summary);
    return;
  }
  process.stdout.write(`Workflow plan: ${plan.profile} -> ${plan.target}
`);
  for (const operation of plan.operations) {
    process.stdout.write(
      `${operation.status.toUpperCase().padEnd(9)} ${operation.kind.padEnd(13)} ${operation.path} \u2014 ${operation.reason}
`
    );
  }
}
function printBootstrapPlan(plan, json) {
  if (json) {
    printJson(summarizeBootstrapPlan(plan));
    return;
  }
  process.stdout.write(`Bootstrap skill plan: ${plan.agent}
`);
  for (const operation of plan.operations) {
    process.stdout.write(
      `${operation.status.toUpperCase().padEnd(9)} ${operation.agent.padEnd(7)} ${operation.path} \u2014 ${operation.reason}
`
    );
  }
}
function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
