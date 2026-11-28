#!/bin/bash
# Rebuilds the tower's real-type aircraft models from FlightGear (GPL) sources cloned under /home/user/fg
set -e
O=${1:-/home/user/twr-sim/public/models3d}; T=/home/user/fgtools; F=/home/user/fg
cd $F/737NG && python3 $T/fg2glb.py $O/B738.glb . Models/738.xml 2048 "tex=737-800.png>$PWD/Models/Liveries-800/THY-800.png" "skip=pushback|cockpit" | tail -1
cd $F/A320-family && H=$PWD/Models/Liveries/A320-House.png && python3 $T/fg2glb.py $O/A320.glb . XMLs/A320.xml 2048 "skip=v2500|iae" "tex=A320-NWA.png>$H" "tex=NWA.png>$H" | tail -1
cd $F/747-400 && python3 $T/fg2glb.py $O/B744.glb . Models/747-400.xml 2048 | tail -1
cd $F/A310 && python3 $T/fg2glb.py $O/A310.glb . Models/A310-308.xml 2048 "tex=HF.png>$PWD/Models/Liveries/TS00.png" | tail -1
cd $F/767-300 && python3 $T/fg2glb.py $O/B763.glb . Models/767-300.xml 2048 "skip=Operations|winglet|door" "tex=TFL.png>$PWD/Models/DAL.png" | tail -1
cd $F/Q400 && python3 $T/fg2glb.py $O/DH8D.glb . Models/q400.xml 2048 "skip=jacks|overhead|pedestal" "drop=propdisc|stair" | tail -1
cd $F/GulfstreamG550 && python3 $T/fg2glb.py $O/GLF5.glb . Models/GulfstreamG550.xml 2048 "skip=strobe|radio|gear-control" | tail -1
cd $F/c172p && python3 $T/fg2glb.py $O/C172.glb . Models/c172p.xml 2048 "skip=yoke|pedal|immat|canvas|label|interior|panel|pedestal" "drop=^Plane|Fast|Cover|^box|Seat|Firewall|Throttle|Mixture|Fuel|Switch|Trim|Carb|Pedestal|^panel|Panel|int_|intle|windlocket" | tail -1
cd $F/Citation-Bravo && python3 $T/fg2glb.py $O/BE40.glb . Models/Bravo.xml 2048 "drop=glow|Flash|Recog|nav|beacon|Wlight|interior" | tail -1
