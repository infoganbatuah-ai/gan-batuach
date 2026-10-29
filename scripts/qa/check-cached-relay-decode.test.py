import importlib.util, pathlib, tempfile, unittest
spec = importlib.util.spec_from_file_location('probe', pathlib.Path(__file__).with_name('check-cached-relay-decode.py'))
probe = importlib.util.module_from_spec(spec); spec.loader.exec_module(probe)
class Boundaries(unittest.TestCase):
 def test_symlink_file_and_parent_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d).resolve(); folder=root/'real';folder.mkdir(); f=folder/'segment-1.ts';f.write_bytes(b'fixture')
   link=root/'link';link.symlink_to(folder,target_is_directory=True)
   with self.assertRaisesRegex(ValueError,'SYMLINK'):probe.read_bounded(link/'segment-1.ts',20)
   leaf=root/'leaf';leaf.symlink_to(f)
   with self.assertRaisesRegex(ValueError,'SYMLINK'):probe.read_bounded(leaf,20)
 def test_size_bound(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d).resolve()/'data';p.write_bytes(b'12345')
   with self.assertRaisesRegex(ValueError,'SIZE'):probe.read_bounded(p,4)
 def test_playlist_network_traversal_and_extra_paths_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d).resolve();folder=root/('dvr_'+'a'*18+'_1');folder.mkdir();(folder/'segment-1.ts').write_bytes(b'fixture')
   playlist=folder/'index.m3u8'
   for name in ['http://example.invalid/a.ts','../segment-1.ts','sub/segment-1.ts','file:///tmp/video.ts','segment-1.ts?token=x']:
    playlist.write_text('#EXTM3U\n'+name+'\n');self.assertEqual(probe.candidates(root),{})
 def test_no_decode_on_missing_segment_and_accept_complete(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d).resolve();folder=root/('dvr_'+'a'*18+'_1');folder.mkdir();(folder/'index.m3u8').write_text('#EXTM3U\nsegment-1.ts\n')
   self.assertEqual(probe.candidates(root),{})
   (folder/'segment-1.ts').write_bytes(b'fixture');row=probe.candidates(root)[1]
   self.assertEqual(row['sequence'],1);self.assertEqual(row['_content'],b'fixture')
 def test_subprocess_pipe_only(self):
  from unittest.mock import patch
  import subprocess
  with patch.object(probe.subprocess,'run',return_value=subprocess.CompletedProcess([],0,b'# header\n0,0,0,1,1,'+b'a'*32+b'\n0,1,1,1,1,'+b'b'*32+b'\n',b'')) as run:
   self.assertTrue(probe.decode(b'fixture')['decodePassed']);args=run.call_args.args[0]
   self.assertEqual(args[args.index('-protocol_whitelist')+1],'pipe');self.assertEqual(args[args.index('-i')+1],'pipe:0')
if __name__=='__main__':unittest.main()
