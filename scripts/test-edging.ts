import { parseEdging } from "../src/lib/edging";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = parseEdging("L$1$L$1$W$1$");
assert(a?.sides.L1?.code === "1", "L1 низ");
assert(a?.sides.L2?.code === "1", "L2 верх");
assert(a?.sides.W1?.code === "1", "W1 лево");
assert(!a?.sides.W2, "W2 пусто");

const b = parseEdging("L$1,1$L$1$W$1$");
assert(b?.sides.L1?.code === "1,1", "L1 толщина");
assert(b?.sides.L2?.code === "1", "L2");

const c = parseEdging("L$1S$1");
assert(c?.sides.L1?.code === "1", "L1 from bazis sample");
assert(c?.extra[0] === "S$1", "extra S");

console.log("edging parser: OK");
