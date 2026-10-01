# -*- coding: utf-8 -*-
"""
lab1_request_response.py  -  Lab 1, Kafka Fundamentals.

The Horizon Bank fund-transfer service as it works TODAY: after every transfer it
calls four downstream systems over HTTP, one after the other, and waits for
each answer (synchronous request-response).

No Kafka and no pip install - standard library only.

    python lab1_request_response.py                     # all four systems healthy
    python lab1_request_response.py --sms-down          # SMS gateway hangs
    python lab1_request_response.py --sms-down --parallel

The four "downstream systems" are fake HTTP endpoints started inside this same
process on http://localhost:8700, each with a fixed response time.
"""
import argparse
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8700

# response time of each downstream system, in milliseconds
DOWNSTREAM = {"fraud": 40, "ledger": 30, "sms": 25, "warehouse": 60}

TIMEOUT_S = 2.0        # how long the transfer service waits for each call
REQUEST_THREADS = 4    # the transfer service's worker threads
TRANSFERS = 12

SMS_DOWN = False       # set from the command line


# --------------------------------------------------------------------------
# the fake downstream systems
# --------------------------------------------------------------------------
class Downstream(BaseHTTPRequestHandler):
    def do_POST(self):
        name = self.path.strip("/")
        if name == "sms" and SMS_DOWN:
            time.sleep(10)                 # the vendor has gone quiet: no answer
        else:
            time.sleep(DOWNSTREAM[name] / 1000.0)
        try:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        except OSError:
            pass                           # the caller already gave up on us

    def log_message(self, *args):          # keep the console readable
        pass


def start_downstream():
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.request_queue_size = 64    # room for every concurrent call
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Downstream)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# --------------------------------------------------------------------------
# the transfer service
# --------------------------------------------------------------------------
def call(name):
    """One synchronous call: send the request, then BLOCK until the answer."""
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request("http://127.0.0.1:%d/%s" % (PORT, name),
                                     data=b"{}", method="POST")
        urllib.request.urlopen(req, timeout=TIMEOUT_S).read()
        return name, True, (time.perf_counter() - t0) * 1000
    except Exception:
        return name, False, (time.perf_counter() - t0) * 1000


def transfer(txn_no, parallel):
    t0 = time.perf_counter()
    results = []
    if parallel:
        # all four calls at once - the transfer waits for the SLOWEST one
        with ThreadPoolExecutor(max_workers=len(DOWNSTREAM)) as pool:
            results = list(pool.map(call, DOWNSTREAM))
    else:
        # one after the other - the transfer waits for the SUM of all four
        for name in DOWNSTREAM:
            r = call(name)
            results.append(r)
            if not r[1]:
                break                      # a failed call fails the request
    ok = all(r[1] for r in results) and len(results) == len(DOWNSTREAM)
    ms = (time.perf_counter() - t0) * 1000
    detail = " | ".join("%s %d" % (n, t) if good else "%s TIMEOUT" % n
                        for n, good, t in results)
    print("TXN-%03d  %-6s %5d ms   %s" % (txn_no, "OK" if ok else "FAILED", ms, detail),
          flush=True)
    return ok, ms


def main():
    global SMS_DOWN
    ap = argparse.ArgumentParser()
    ap.add_argument("--sms-down", action="store_true", help="the SMS gateway stops answering")
    ap.add_argument("--parallel", action="store_true", help="call the four systems concurrently")
    ap.add_argument("--transfers", type=int, default=TRANSFERS)
    args = ap.parse_args()
    SMS_DOWN = args.sms_down

    srv = start_downstream()
    print("Horizon Bank transfer service - synchronous request-response")
    print("downstream : " + " | ".join("%s %d ms" % kv for kv in DOWNSTREAM.items())
          + ("   (SMS gateway DOWN)" if SMS_DOWN else ""))
    print("mode       : %s calls, timeout %.1f s, %d request threads, %d transfers\n"
          % ("parallel" if args.parallel else "sequential", TIMEOUT_S, REQUEST_THREADS,
             args.transfers))

    for name in DOWNSTREAM:                # warm-up: open each system once, untimed
        if not (name == "sms" and SMS_DOWN):
            call(name)

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=REQUEST_THREADS) as pool:
        outcomes = list(pool.map(lambda n: transfer(n, args.parallel),
                                 range(1, args.transfers + 1)))
    wall = time.perf_counter() - t0

    ok = sum(1 for good, _ in outcomes if good)
    avg = sum(ms for _, ms in outcomes) / len(outcomes)
    print("-" * 64)
    print("transfers OK : %d / %d" % (ok, len(outcomes)))
    print("avg latency  : %d ms per transfer" % avg)
    print("wall clock   : %.2f s  ->  %.1f transfers per second"
          % (wall, len(outcomes) / wall))
    srv.shutdown()


if __name__ == "__main__":
    main()
