# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A minimalistic Node.js CLI for configuring the JDY-41 wireless serial module over USB-serial, so the user doesn't need the vendor's special configuration software. See `README.md` for the instruction list, and the datasheet at `docs/jdy-41-manual.pdf` for the full raw parameter byte format (baud rate, channel, power, mode, wireless ID, response, backup byte) — the friendly value tables for the `configure` command live in `friendly-params.js`, not in prose docs.

## Commands

- Run: `npm start <instruction> [params...]`, e.g. `npm start configure-parameters 04 00 09 A0 66 77 88 55 01 00`
- Friendly configuration: `npm start configure -- --baud 9600 --channel 5 --power 0db --mode transparent --id AABBCCDD --response no` (see `npm start configure -- --help`). The `--` is required — without it, npm intercepts `--help` (and possibly other flags) itself instead of forwarding to the script.
- Install: `npm i`
- No build step, no lint config, no test suite.

## Architecture

Three files carry the whole tool:

- **`port.mjs`** — opens the `SerialPort` connection. On import, it auto-detects the device path by scanning `SerialPort.list()` for a path matching a regex (default `/tty.*usb/i`, overridable as the `getPortPath` default parameter), and exports a single unopened `SerialPort` instance at a fixed baud rate (9600). Both the regex and baud rate are meant to be edited directly in this file for a different setup. `index.js` imports it dynamically (`await import('./port.mjs')`), deferred until after argument validation, so instruction errors, `configure` validation errors, and `configure -- --help` all work without a device connected.
- **`friendly-params.js`** — lookup tables (`baudRates`, `powerLevels`, `modes`) and validation for the `configure` command. `resolveConfigureParams` converts friendly flag values (e.g. `--power 0db`, `--mode transparent`) into the hex byte array `configure-parameters` expects, throwing a descriptive error (listing valid values) on anything invalid. `configureHelpText` renders `configure -- --help`. This is the single source of truth for these value tables — don't duplicate them in README or comments.
- **`index.js`** — CLI entry point and protocol logic:
  - `heads`: maps instruction names (e.g. `read-device-id`) to their hex command header.
  - When the instruction is `configure`, `process.argv` is parsed with `node:util`'s `parseArgs` and translated via `resolveConfigureParams` into hex params, then treated as `configure-parameters` from that point on — all before `port.mjs` is imported, so this validation (including `--help`) never requires a device.
  - `getInstruction`/`getBuffer`: assemble `<head> [params...] <terminator>` (terminator `0D 0A`) into the byte buffer actually written to the port.
  - `writeInstruction`: writes the buffer, then self-schedules a retry via `setTimeout` if no response byte has arrived within 100ms. This exists because the JDY-41 ignores the first instruction it receives after power-on — resending is the workaround.
  - The `port.on('data', ...)` handler accumulates hex bytes into `response` until the terminator is seen, then decodes and prints the result. Decoding branches on whether the response starts with `+` (`0x2B`, an ASCII string response, e.g. device ID/version) versus raw hex bytes (e.g. read-parameters output) — see `responseToString`.
  - This assumes each `'data'` event delivers exactly one byte, which holds in practice at 9600 baud but is not guaranteed by the serial API in general.

## Notes carried over from README

- After `configure-parameters`, the module must be power-cycled before `read-parameters` will reflect the new values.
