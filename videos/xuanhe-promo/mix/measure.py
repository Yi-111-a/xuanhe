import subprocess,re
def curve(f):
    out=subprocess.run(['ffmpeg','-v','error','-i',f,'-af','ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-','-f','null','-'],capture_output=True,text=True).stdout
    return [float(x) if x not in('-inf','inf') else -120 for x in re.findall(r'lavfi.r128.M=(\S+)',out)]
vo=curve('mix/stem-vo.wav'); bed=curve('mix/stem-bed.wav')
idx=range(0,min(len(vo),len(bed)),5)
m=[vo[i]-bed[i] for i in idx if vo[i]>-25]
print('voice over music while speaking: min %.1f  p25 %.1f  median %.1f dB'%(min(m),sorted(m)[len(m)//4],sorted(m)[len(m)//2]))
q=[bed[i] for i in idx if vo[i]<-60 and 4<i/10<59]
s=[bed[i] for i in idx if vo[i]>-25]
print('music alone median %.1f LUFS | music under voice median %.1f LUFS'%(sorted(q)[len(q)//2],sorted(s)[len(s)//2]))
