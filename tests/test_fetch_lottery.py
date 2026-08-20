import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "fetch_lottery.py"
SPEC = importlib.util.spec_from_file_location("fetch_lottery", MODULE_PATH)
fetch_lottery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_lottery)


class LotteryDataTests(unittest.TestCase):
    def historical_table(self, rows):
        headers = "".join(f"<th>{header}</th>" for header in fetch_lottery.EXPECTED_HEADERS)
        body = "".join(
            "<tr>" + "".join(f"<td>{value}</td>" for value in row) + "</tr>"
            for row in rows
        )
        return f"<html><table><tr>{headers}</tr>{body}</table></html>"

    def valid_rows(self):
        return [
            (2021, "274,237", "269,424", "241,299", "28,125", "124,415"),
            (2022, "308,613", "301,447", "211,304", "90,143", "131,924"),
            (2023, "483,927", "474,421", "309,241", "165,180", "127,600"),
            (2024, "780,884", "758,994", "350,103", "408,891", "188,400"),
            (2025, "479,953", "470,342", "423,028", "47,314", "135,137"),
            (2026, "358,737", "343,981", "336,153", "7,828", "120,141"),
        ]

    def test_registration_history_parses_and_labels_selection_system(self):
        result = fetch_lottery.registration_history(self.historical_table(self.valid_rows()))
        self.assertEqual([row["fy"] for row in result], list(range(2021, 2027)))
        self.assertEqual(result[0]["system"], "registration-centric")
        self.assertEqual(result[-1]["system"], "beneficiary-centric")
        self.assertEqual(result[-1]["single"] + result[-1]["multiple"], result[-1]["eligible"])

    def test_registration_history_rejects_non_reconciling_categories(self):
        rows = self.valid_rows()
        rows[-1] = (2026, "358,737", "343,981", "336,153", "7,827", "120,141")
        with self.assertRaisesRegex(ValueError, "do not reconcile"):
            fetch_lottery.registration_history(self.historical_table(rows))

    def test_registration_history_rejects_missing_fiscal_year(self):
        with self.assertRaisesRegex(ValueError, "complete FY2021-FY2026"):
            fetch_lottery.registration_history(self.historical_table(self.valid_rows()[:-1]))

    def test_projected_weights_require_all_verified_probabilities(self):
        rule = ("probability of being selected and the probability of selection for a unique "
                "beneficiary will be 15.29 percent for level I, 30.58 percent for level II, "
                "45.87 percent for level III, and 61.16 percent for level IV.")
        weights = fetch_lottery.projected_weights(rule)
        self.assertEqual([row["weight"] for row in weights], [1, 2, 3, 4])
        self.assertEqual([row["projected"] for row in weights], [15.29, 30.58, 45.87, 61.16])
        with self.assertRaisesRegex(ValueError, "could not be verified"):
            fetch_lottery.projected_weights(rule.replace("61.16", "61.15"))


if __name__ == "__main__":
    unittest.main()
