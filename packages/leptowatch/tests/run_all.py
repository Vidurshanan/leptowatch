"""Run every test without needing pytest:  python tests/run_all.py"""
import inspect
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_core  # noqa: E402

fails = 0
for name, fn in inspect.getmembers(test_core, inspect.isfunction):
    if not name.startswith('test_'):
        continue
    t0 = time.time()
    try:
        fn()
        print(f'PASS  {name}  ({time.time() - t0:.1f}s)')
    except Exception:  # noqa: BLE001
        fails += 1
        print(f'FAIL  {name}')
        traceback.print_exc()
print(f'\n{"ALL TESTS PASSED" if not fails else f"{fails} TEST(S) FAILED"}')
sys.exit(1 if fails else 0)
