#!/bin/bash
set -euxo pipefail

# ── Rust ──────────────────────────────────────────────────────────────────────
if ! command -v cargo &>/dev/null; then
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env" 2>/dev/null || true

# ── Node dependencies ─────────────────────────────────────────────────────────
pnpm i

# ── wasm-bindgen ──────────────────────────────────────────────────────────────
if ! command -v wasm-bindgen &>/dev/null; then
	cargo install wasm-bindgen-cli --version 0.2.100
fi

# ── wasm-opt (Binaryen) ───────────────────────────────────────────────────────
if ! command -v wasm-opt &>/dev/null; then
	mkdir -p ~/.local/bin ~/.local/lib
	VER=$(curl --silent -qI https://github.com/WebAssembly/binaryen/releases/latest | awk -F '/' '/^location/ {print substr($NF, 1, length($NF)-1)}')
	curl -LO https://github.com/WebAssembly/binaryen/releases/download/$VER/binaryen-${VER}-x86_64-linux.tar.gz
	tar xf binaryen-${VER}-x86_64-linux.tar.gz
	rm -f binaryen-${VER}-x86_64-linux.tar.gz
	cp binaryen-${VER}/bin/* ~/.local/bin/
	# lib directory may not exist in all binaryen releases; skip silently if absent
	[ -d binaryen-${VER}/lib ] && cp binaryen-${VER}/lib/* ~/.local/lib/ || true
	rm -rf binaryen-${VER}
fi

# ── wasm-snip ─────────────────────────────────────────────────────────────────
if ! cargo install --list 2>/dev/null | grep -q "^wasm-snip "; then
	cargo install --git https://github.com/r58playz/wasm-snip
fi

# ── Build ─────────────────────────────────────────────────────────────────────
pnpm rewriter:build
pnpm build
