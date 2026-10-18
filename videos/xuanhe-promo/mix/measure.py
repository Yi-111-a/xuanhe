import subprocess,re
def curve(f):
    out=subprocess.run(['ffmpeg','-v','error','-i',f,'-af','ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-','-f','null','-'],capture_output=True,text=True).stdout
    return [float(x) if x not in('-inf','inf') else -120 for x in re.findall(r'lavfi.r128.M=(\S+)',out)]
vo=curve('mix/stem-vo.wav'); bed=curve('mix/stem-bed.wav')
idx=range(0,len(vo),5)
sp=[i for i in idx if vo[i]>-20]   # sustained speech (not word gaps / line edges)
m=sorted(vo[i]-bed[i] for i in sp)
print('during speech: voice over music median %.1f dB, p10 %.1f dB, min %.1f dB'%(m[len(m)//2], m[len(m)//10], m[0]))
worst=sorted(((vo[i]-bed[i]), i/10) for i in sp)[:6]; print('worst:', [(t, round(d,1)) for d,t in worst])
