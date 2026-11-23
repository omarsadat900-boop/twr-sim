import json,sys
w=sys.argv[1]
d=json.load(open(w+'/data/ltac.json'))
geo=json.load(open('geo/geo_tr.json'))
wx=open(w+'/public/wx.js').read()
net=open(w+'/public/net.js').read()
D=json.dumps(d,separators=(',',':')); G=json.dumps(geo,separators=(',',':'),ensure_ascii=False)
for name in ['pilot','tower']:
    t=open(f'{w}/public/{name}.template.html').read()
    t=t.replace('/*__WX__*/',wx).replace('/*__NET__*/',net).replace('__GEO__',G).replace('__DATA__',D)
    open(f'{w}/public/{name}.html','w').write(t)
t=open(w+'/public/chart.template.html').read(); open(w+'/public/chart.html','w').write(t.replace('__DATA__',D))
