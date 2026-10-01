# helper for recording lab output:  c <name> '<command run inside kafka1>'
export MSYS_NO_PATHCONV=1
OUT="$(dirname "${BASH_SOURCE[0]}")/out"
c() { local n=$1; shift; { echo "\$ $*"; docker exec -i ${NODE:-kafka1} bash -c "$*" 2>&1 | grep -v 'KIP-848) is production-ready'; } > "$OUT/$n.txt"; cat "$OUT/$n.txt"; echo; }
