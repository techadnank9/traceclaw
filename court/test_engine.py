import unittest

from court.engine import admit, archive, evaluate, night_fail, propose, run_night2


class CourtTest(unittest.TestCase):
    def test_cut_batch_vetoed(self):
        v = admit("cut_batch", night_fail("job_a", "tr-night1"), [archive()])
        self.assertFalse(v["ok"])
        self.assertEqual(v["veto_count"], 1)

    def test_free_ckpt_admitted(self):
        v = admit("free_ckpt", night_fail("job_a", "tr-night1"), [archive()])
        self.assertTrue(v["ok"])

    def test_idempotent(self):
        fail = night_fail("job_a", "tr-night1")
        gold = [archive()]
        a = propose("free_ckpt", fail, gold, [])
        b = propose("free_ckpt", fail, gold, [a])
        self.assertEqual(a.id, b.id)

    def test_eval_ladder(self):
        self.assertEqual(evaluate([])["passed"], 2)
        law = propose("free_ckpt", night_fail("job_a", "tr-night1"), [archive()], [])
        self.assertEqual(evaluate([law])["passed"], 3)
        self.assertTrue(run_night2([law]).passed)
        self.assertEqual(run_night2([law]).batch, 2048)


if __name__ == "__main__":
    unittest.main()
