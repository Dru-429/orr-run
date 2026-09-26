# Reproduce CC0 horn edits. Requires ffmpeg; pass a directory containing the six source MP3s.
import array,wave,math,subprocess,json,hashlib
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]/'public/audio/horns'
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/orr-horn-sources')
# crop interval, sustain loop interval relative to cropped start
settings={'car':(0,.34,.065,.18),'car2':(.04,1.52,.23,1.13),'compact':(.2,.74,.095,.24),'bike':(.48,1.17,.135,.28),'bus':(0,1.15,.18,.49),'truck':(0,1.4,.12,.32)}
for k,(start,end,ls,le) in settings.items():
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source/(k+'.mp3')),'-ss',str(start),'-t',str(end-start),'-af','highpass=f=90,lowpass=f=7000','-ac','1','-ar','22050',str(source/(k+'-trim.wav'))],check=True)
 with wave.open(str(source/(k+'-trim.wav'))) as w:a=array.array('h',w.readframes(w.getnframes()));r=w.getframerate()
 a=[x/32768 for x in a];rms=(sum(x*x for x in a[int(ls*r):int(le*r)])/(int(le*r)-int(ls*r)))**.5;gain=min(.22/rms,.88/max(map(abs,a)))
 a=[x*gain for x in a];fade=int(.01*r);loopEnd=int(le*r);loopStart=int(ls*r)
 for n in range(fade):
  t=n/(fade-1);i=loopEnd-fade+n;a[i]=a[i]*(1-t)+a[loopStart-fade+n]*t
 for n in range(min(int(.008*r),len(a))):a[n]*=n/(.008*r)
 for n in range(min(int(.04*r),len(a))):a[-1-n]*=n/(.04*r)
 path=root/(k+'.wav')
 with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(r);w.writeframes(array.array('h',[round(max(-1,min(1,x))*32767) for x in a]).tobytes())
 print(k,'seconds',round(len(a)/r,3),'bytes',path.stat().st_size,'sha256',hashlib.sha256(path.read_bytes()).hexdigest())
