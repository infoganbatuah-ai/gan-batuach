import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('soak', pathlib.Path(__file__).with_name('observe-homeqa-hls.py'))
soak = importlib.util.module_from_spec(spec)
spec.loader.exec_module(soak)


class ProgressTests(unittest.TestCase):
    def test_initial_decoded_segment_is_baseline_not_progress(self):
        state = {'lastAdvanceAt': 0}
        result = soak.update_progress(state, {'digest': b'a', 'sequence': 1, 'lastName': 'one'}, 1)
        self.assertTrue(result['baseline']); self.assertFalse(result['advanced'])

    def test_same_segment_becomes_stalled_without_counting_decoded_cache(self):
        state = {'lastAdvanceAt': 0, 'digest': b'a', 'sequence': 1, 'lastName': 'one'}
        result = soak.update_progress(state, {'digest': b'a', 'sequence': 1, 'lastName': 'one'}, 21)
        self.assertTrue(result['stalled']); self.assertFalse(result['advanced'])

    def test_new_name_with_identical_content_is_not_progress(self):
        state = {'lastAdvanceAt': 0, 'digest': b'a', 'sequence': 1, 'lastName': 'one'}
        self.assertFalse(soak.update_progress(state, {'digest': b'a', 'sequence': 2, 'lastName': 'two'}, 5)['advanced'])

    def test_sequence_reset_is_reported_separately_from_forward_progress(self):
        state = {'lastAdvanceAt': 0, 'digest': b'a', 'sequence': 100, 'lastName': 'old'}
        result = soak.update_progress(state, {'digest': b'b', 'sequence': 0, 'lastName': 'new'}, 5)
        self.assertTrue(result['sequenceReset']); self.assertFalse(result['advanced'])

    def test_changed_content_with_forward_sequence_is_progress(self):
        state = {'lastAdvanceAt': 0, 'digest': b'a', 'sequence': 1, 'lastName': 'one'}
        result = soak.update_progress(state, {'digest': b'b', 'sequence': 2, 'lastName': 'two'}, 10)
        self.assertTrue(result['advanced']); self.assertFalse(result['stalled'])

    def test_timeout_stage_is_saved_without_capability_url(self):
        source = {'label': 'synthetic', 'port': 18082, 'stream': 'dvr_0123456789abcdef01_1'}
        state = {'authorizationAttempts': 1, 'lastAdvanceAt': 0,
                 'url': 'http://127.0.0.1:18082/hls/dvr_0123456789abcdef01_1/index.m3u8?token=SYNTHETIC_CAPABILITY'}
        with patch.object(soak.probe, 'call', side_effect=TimeoutError()):
            result = soak.sample_source(source, state, None, 0)
        self.assertEqual(result['stage'], 'playlist')
        self.assertEqual(result['error'], 'TimeoutError')
        self.assertNotIn('SYNTHETIC_CAPABILITY', json.dumps(result))

    def test_failed_playlist_records_status_without_media_or_url(self):
        source = {'label': 'synthetic', 'port': 18082, 'stream': 'dvr_0123456789abcdef01_1'}
        state = {'authorizationAttempts': 1, 'lastAdvanceAt': 0,
                 'url': 'http://127.0.0.1:18082/hls/dvr_0123456789abcdef01_1/index.m3u8?token=SYNTHETIC_CAPABILITY'}
        with patch.object(soak.probe, 'call', return_value=(503, b'')):
            result = soak.sample_source(source, state, None, 0)
        self.assertEqual(result['playlistHttpStatus'], 503)
        self.assertEqual(result['error'], 'PLAYLIST_FAILED')
        self.assertNotIn('url', result)


if __name__ == '__main__':
    unittest.main()
