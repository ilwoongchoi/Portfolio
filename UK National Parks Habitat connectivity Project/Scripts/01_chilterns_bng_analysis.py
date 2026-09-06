# ===== QGIS 4.2 Chilterns - Paste ONE block at a time =====
# No functions - QGIS console breaks multi-line def paste

# Block 0: Setup
import processing
from qgis.core import QgsProject, QgsVectorLayer, QgsProcessingFeedback, QgsField
from qgis.PyQt.QtCore import QVariant
fb = QgsProcessingFeedback()
prj = QgsProject.instance()
OUT = r"d:\새 폴더\chilterns_results.gpkg"
print("Setup OK")

# Block 1: Chilterns boundary
aonb=QgsVectorLayer(r"d:\새 폴더\Areas_of_Outstanding_Natural_Beauty_England.gpkg\Areas_of_Outstanding_Natural_Beauty_England.gpkg|layername=Areas_of_Outstanding_Natural_Beauty_England","aonb","ogr")
print(f"AONB valid: {aonb.isValid()}, features: {aonb.featureCount()}")
chil=processing.run("native:extractbyexpression",{"INPUT":aonb,"EXPRESSION":"\"name\" LIKE '%Chilterns%'","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":chil,"OUTPUT":OUT,"LAYER_NAME":"chilterns_boundary","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: chilterns_boundary")
prj.removeMapLayer(aonb.id())
chil=QgsVectorLayer(f"{OUT}|layername=chilterns_boundary","chilterns_boundary","ogr")
prj.addMapLayer(chil)
print(f"Step1 OK: {chil.featureCount()} features")

# Block 2: Clip AW
aw=QgsVectorLayer(r"d:\새 폴더\Ancient_Woodland_England.gpkg (1)\Ancient_Woodland_England.gpkg","aw","ogr")
print(f"AW valid: {aw.isValid()}")
awc=processing.run("native:clip",{"INPUT":aw,"OVERLAY":chil,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":awc,"OUTPUT":OUT,"LAYER_NAME":"AW_chilterns","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_chilterns")
prj.removeMapLayer(aw.id())
awc=QgsVectorLayer(f"{OUT}|layername=AW_chilterns","AW_chilterns","ogr")
prj.addMapLayer(awc)
print(f"Step2 OK: {awc.featureCount()} features")

# Block 3: Clip CG
cg=QgsVectorLayer(r"d:\새 폴더\Habitat_Networks_Individual_England.gpkg\Habitat_Networks_Individual_England.gpkg|layername=Calcareous_grassland","cg","ogr")
print(f"CG valid: {cg.isValid()}")
cgc=processing.run("native:clip",{"INPUT":cg,"OVERLAY":chil,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":cgc,"OUTPUT":OUT,"LAYER_NAME":"CG_chilterns","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: CG_chilterns")
prj.removeMapLayer(cg.id())
cgc=QgsVectorLayer(f"{OUT}|layername=CG_chilterns","CG_chilterns","ogr")
prj.addMapLayer(cgc)
print(f"Step3 OK: {cgc.featureCount()} features")

# Block 4: Clip PHI (using pre-converted GPKG)
phi=QgsVectorLayer(r"d:\새 폴더\PHI_full.gpkg","phi","ogr")
print(f"PHI valid: {phi.isValid()}, features: {phi.featureCount()}")
phic=processing.run("native:clip",{"INPUT":phi,"OVERLAY":chil,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":phic,"OUTPUT":OUT,"LAYER_NAME":"PHI_chilterns","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: PHI_chilterns")
prj.removeMapLayer(phi.id())
phic=QgsVectorLayer(f"{OUT}|layername=PHI_chilterns","PHI_chilterns","ogr")
prj.addMapLayer(phic)
print(f"Step4 OK: {phic.featureCount()} features")

# Block 6: CG centroids + grass_id
cc=processing.run("native:centroids",{"INPUT":cgc,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
cc.dataProvider().addAttributes([QgsField("grass_id",QVariant.Int)]);cc.updateFields()
gi=cc.fields().indexOf("grass_id")
cc.startEditing()
i=1
for f in cc.getFeatures():
    cc.changeAttributeValue(f.id(),gi,i)
    i+=1
cc.commitChanges()
processing.run("native:savefeatures",{"INPUT":cc,"OUTPUT":OUT,"LAYER_NAME":"CG_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: CG_centroids")
cc=QgsVectorLayer(f"{OUT}|layername=CG_centroids","CG_centroids","ogr")
print(f"Step6 OK: {cc.featureCount()} centroids")

# Block 7: AW centroids
ac=processing.run("native:centroids",{"INPUT":awc,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":ac,"OUTPUT":OUT,"LAYER_NAME":"AW_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_centroids")
ac=QgsVectorLayer(f"{OUT}|layername=AW_centroids","AW_centroids","ogr")
print(f"Step7 OK: {ac.featureCount()} centroids")

# Block 8: AW to CG distance
dm=processing.run("qgis:distancematrix",{"INPUT":ac,"INPUT_FIELD":"fid","TARGET":cc,"TARGET_FIELD":"grass_id","NEAREST_POINTS":1,"MATRIX_TYPE":0,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
aj=processing.run("native:joinattributestable",{"INPUT":ac,"FIELD":"fid","INPUT_2":dm,"FIELD_2":"InputID","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
awd=processing.run("native:joinattributesbylocation",{"INPUT":awc,"JOIN":aj,"PREDICATE":[0],"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":awd,"OUTPUT":OUT,"LAYER_NAME":"AW_distance_to_CG","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_distance_to_CG")
awd=QgsVectorLayer(f"{OUT}|layername=AW_distance_to_CG","AW_distance_to_CG","ogr")
prj.addMapLayer(awd)
print("Step8 OK")

# Block 9: 250m Buffer
ab=processing.run("native:buffer",{"INPUT":awc,"DISTANCE":250,"SEGMENTS":5,"DISSOLVE":True,"END_CAP_STYLE":0,"JOIN_STYLE":0,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":ab,"OUTPUT":OUT,"LAYER_NAME":"AW_250m_buffer","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_250m_buffer")
ab=QgsVectorLayer(f"{OUT}|layername=AW_250m_buffer","AW_250m_buffer","ogr")
prj.addMapLayer(ab)
print("Step9 OK")

# Block 10: Gap (buffer - CG)
gap=processing.run("native:difference",{"INPUT":ab,"OVERLAY":cgc,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":gap,"OUTPUT":OUT,"LAYER_NAME":"gap_raw","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_raw")
gap=QgsVectorLayer(f"{OUT}|layername=gap_raw","gap_raw","ogr")
print(f"Step10 OK: {gap.featureCount()} features")

# Block 11: Gap x PHI
gp=processing.run("native:intersection",{"INPUT":gap,"OVERLAY":phic,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
gp.dataProvider().addAttributes([QgsField("area_ha",QVariant.Double)]);gp.updateFields()
ahi=gp.fields().indexOf("area_ha")
gp.startEditing()
for f in gp.getFeatures():
    gp.changeAttributeValue(f.id(),ahi,f.geometry().area()/10000.0)
gp.commitChanges()
processing.run("native:savefeatures",{"INPUT":gp,"OUTPUT":OUT,"LAYER_NAME":"gap_phi","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_phi")
gp=QgsVectorLayer(f"{OUT}|layername=gap_phi","gap_phi","ogr")
prj.addMapLayer(gp)
print(f"Step11 OK: {gp.featureCount()} features")

# Block 12: Suitable habitats
su=processing.run("native:extractbyexpression",{"INPUT":gp,"EXPRESSION":"\"MainHabs\" IS NOT NULL","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":su,"OUTPUT":OUT,"LAYER_NAME":"AW_connectivity_opportunities","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_connectivity_opportunities")
su=QgsVectorLayer(f"{OUT}|layername=AW_connectivity_opportunities","AW_connectivity_opportunities","ogr")
prj.addMapLayer(su)
print(f"Step12 OK: {su.featureCount()} features")

# Block 13: Opportunity to CG distance
oc=processing.run("native:centroids",{"INPUT":su,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":oc,"OUTPUT":OUT,"LAYER_NAME":"opp_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
oc=QgsVectorLayer(f"{OUT}|layername=opp_centroids","opp_centroids","ogr")
dm2=processing.run("qgis:distancematrix",{"INPUT":oc,"INPUT_FIELD":"fid","TARGET":cc,"TARGET_FIELD":"grass_id","NEAREST_POINTS":1,"MATRIX_TYPE":0,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
oj=processing.run("native:joinattributestable",{"INPUT":oc,"FIELD":"fid","INPUT_2":dm2,"FIELD_2":"InputID","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
ow=processing.run("native:joinattributesbylocation",{"INPUT":su,"JOIN":oj,"PREDICATE":[0],"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":ow,"OUTPUT":OUT,"LAYER_NAME":"opp_with_distance","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: opp_with_distance")
ow=QgsVectorLayer(f"{OUT}|layername=opp_with_distance","opp_with_distance","ogr")
print("Step13 OK")

# Block 14: Remove roads
rb=processing.run("native:buffer",{"INPUT":rc,"DISTANCE":10,"SEGMENTS":5,"DISSOLVE":True,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":rb,"OUTPUT":OUT,"LAYER_NAME":"road_10m_buffer","ACTION_ON_EXISTING_FILE":1},feedback=fb)
rb=QgsVectorLayer(f"{OUT}|layername=road_10m_buffer","road_10m_buffer","ogr")
of=processing.run("native:difference",{"INPUT":ow,"OVERLAY":rb,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
of.dataProvider().addAttributes([QgsField("area_ha_final",QVariant.Double),QgsField("priority",QVariant.Double),QgsField("final_score",QVariant.Double)]);of.updateFields()
afi=of.fields().indexOf("area_ha_final")
of.startEditing()
for f in of.getFeatures():
    of.changeAttributeValue(f.id(),afi,f.geometry().area()/10000.0)
of.commitChanges()
processing.run("native:savefeatures",{"INPUT":of,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_final_opportunities")
of=QgsVectorLayer(f"{OUT}|layername=AW_final_opportunities","AW_final_opportunities","ogr")
prj.addMapLayer(of)
print(f"Step14 OK: {of.featureCount()} features")

# Block 15: Final score
md=1;ma=1
for f in of.getFeatures():
    d=f["Distance"];a=f["area_ha_final"]
    if d is not None and d>md: md=d
    if a is not None and a>ma: ma=a
print(f"Max Dist: {md}, Max Area: {ma}")
pi=of.fields().indexOf("priority")
fi2=of.fields().indexOf("final_score")
of.startEditing()
for f in of.getFeatures():
    d=f["Distance"];a=f["area_ha_final"]
    if d is None or d<=0: d=md
    if a is None or a<=0: a=0
    of.changeAttributeValue(f.id(),pi,1-(d/md))
    of.changeAttributeValue(f.id(),fi2,(1-(d/md))*0.5+(a/ma)*0.5)
of.commitChanges()
processing.run("native:savefeatures",{"INPUT":of,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Step15 OK - DONE")
print(f"Results: {OUT}")

# Block 16: Clip Heathland to Chilterns
chil_h = QgsVectorLayer(f"{OUT}|layername=chilterns_boundary","chilterns_boundary","ogr")
print(f"Chilterns (for Heathland) valid: {chil_h.isValid()}, features: {chil_h.featureCount()}")
hl = QgsVectorLayer(r"d:\새 폴더\Habitat_Networks_Individual_England.gpkg\Habitat_Networks_Individual_England.gpkg|layername=Heathland","heath","ogr")
print(f"Heathland valid: {hl.isValid()}, features: {hl.featureCount()}")
hlc = processing.run("native:clip",{"INPUT":hl,"OVERLAY":chil_h,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":hlc,"OUTPUT":OUT,"LAYER_NAME":"Heathland_chilterns","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: Heathland_chilterns")
prj.removeMapLayer(hl.id())
hlc = QgsVectorLayer(f"{OUT}|layername=Heathland_chilterns","Heathland_chilterns","ogr")
prj.addMapLayer(hlc)
print(f"Step16 OK: {hlc.featureCount()} features")

# Block 17: Heathland centroids + heath_id
hc = processing.run("native:centroids",{"INPUT":hlc,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
hc.dataProvider().addAttributes([QgsField("heath_id",QVariant.Int)]);hc.updateFields()
hi = hc.fields().indexOf("heath_id")
hc.startEditing()
i = 1
for f in hc.getFeatures():
    hc.changeAttributeValue(f.id(),hi,i)
    i += 1
hc.commitChanges()
processing.run("native:savefeatures",{"INPUT":hc,"OUTPUT":OUT,"LAYER_NAME":"Heath_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: Heath_centroids")
hc = QgsVectorLayer(f"{OUT}|layername=Heath_centroids","Heath_centroids","ogr")
print(f"Step17 OK: {hc.featureCount()} centroids")

# Block 18: Gap (AW buffer - Heathland)
ab_h = QgsVectorLayer(f"{OUT}|layername=AW_250m_buffer","AW_250m_buffer","ogr")
hlc = QgsVectorLayer(f"{OUT}|layername=Heathland_chilterns","Heathland_chilterns","ogr")
gap_h = processing.run("native:difference",{"INPUT":ab_h,"OVERLAY":hlc,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":gap_h,"OUTPUT":OUT,"LAYER_NAME":"gap_heath_raw","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_heath_raw")
gap_h = QgsVectorLayer(f"{OUT}|layername=gap_heath_raw","gap_heath_raw","ogr")
print(f"Step18 OK: {gap_h.featureCount()} features")

# Block 19: Gap x PHI for Heathland
phic_h = QgsVectorLayer(f"{OUT}|layername=PHI_chilterns","PHI_chilterns","ogr")
gp_h = processing.run("native:intersection",{"INPUT":gap_h,"OVERLAY":phic_h,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
gp_h.dataProvider().addAttributes([QgsField("area_ha_h",QVariant.Double)]);gp_h.updateFields()
ahi_h = gp_h.fields().indexOf("area_ha_h")
gp_h.startEditing()
for f in gp_h.getFeatures():
    gp_h.changeAttributeValue(f.id(),ahi_h,f.geometry().area()/10000.0)
gp_h.commitChanges()
processing.run("native:savefeatures",{"INPUT":gp_h,"OUTPUT":OUT,"LAYER_NAME":"gap_heath_phi","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_heath_phi")
gp_h = QgsVectorLayer(f"{OUT}|layername=gap_heath_phi","gap_heath_phi","ogr")
prj.addMapLayer(gp_h)
print(f"Step19 OK: {gp_h.featureCount()} features")

# Block 20: Suitable habitats (Heathland)
su_h = processing.run("native:extractbyexpression",{"INPUT":gp_h,"EXPRESSION":"\"MainHabs\" IS NOT NULL","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":su_h,"OUTPUT":OUT,"LAYER_NAME":"AW_heath_opportunities","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_heath_opportunities")
su_h = QgsVectorLayer(f"{OUT}|layername=AW_heath_opportunities","AW_heath_opportunities","ogr")
prj.addMapLayer(su_h)
print(f"Step20 OK: {su_h.featureCount()} features")

# Block 21: Heath opportunities to Heathland distance
hc = QgsVectorLayer(f"{OUT}|layername=Heath_centroids","Heath_centroids","ogr")
oc_h = processing.run("native:centroids",{"INPUT":su_h,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":oc_h,"OUTPUT":OUT,"LAYER_NAME":"heath_opp_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
oc_h = QgsVectorLayer(f"{OUT}|layername=heath_opp_centroids","heath_opp_centroids","ogr")
dm2_h = processing.run("qgis:distancematrix",{"INPUT":oc_h,"INPUT_FIELD":"fid","TARGET":hc,"TARGET_FIELD":"heath_id","NEAREST_POINTS":1,"MATRIX_TYPE":0,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
oj_h = processing.run("native:joinattributestable",{"INPUT":oc_h,"FIELD":"fid","INPUT_2":dm2_h,"FIELD_2":"InputID","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
ow_h = processing.run("native:joinattributesbylocation",{"INPUT":su_h,"JOIN":oj_h,"PREDICATE":[0],"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":ow_h,"OUTPUT":OUT,"LAYER_NAME":"heath_opp_with_distance","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: heath_opp_with_distance")
ow_h = QgsVectorLayer(f"{OUT}|layername=heath_opp_with_distance","heath_opp_with_distance","ogr")
print("Step21 OK")

# Block 22: Remove roads (Heathland) and compute area
rb_h = QgsVectorLayer(f"{OUT}|layername=road_10m_buffer","road_10m_buffer","ogr")
of_h = processing.run("native:difference",{"INPUT":ow_h,"OVERLAY":rb_h,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
of_h.dataProvider().addAttributes([
    QgsField("area_ha_fin_h",QVariant.Double),
    QgsField("priority_h",QVariant.Double),
    QgsField("final_sc_h",QVariant.Double)
]);of_h.updateFields()
afi_h = of_h.fields().indexOf("area_ha_fin_h")
of_h.startEditing()
for f in of_h.getFeatures():
    of_h.changeAttributeValue(f.id(),afi_h,f.geometry().area()/10000.0)
of_h.commitChanges()
processing.run("native:savefeatures",{"INPUT":of_h,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities_heath","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_final_opportunities_heath")
of_h = QgsVectorLayer(f"{OUT}|layername=AW_final_opportunities_heath","AW_final_opportunities_heath","ogr")
prj.addMapLayer(of_h)
print(f"Step22 OK: {of_h.featureCount()} features")

# Block 23: Final score (Heathland)
md_h = 1; ma_h = 1
for f in of_h.getFeatures():
    d = f["Distance"]; a = f["area_ha_fin_h"]
    if d is not None and d > md_h: md_h = d
    if a is not None and a > ma_h: ma_h = a
print(f"Heath Max Dist: {md_h}, Max Area: {ma_h}")
pi_h = of_h.fields().indexOf("priority_h")
fi_h = of_h.fields().indexOf("final_sc_h")
of_h.startEditing()
for f in of_h.getFeatures():
    d = f["Distance"]; a = f["area_ha_fin_h"]
    if d is None or d <= 0: d = md_h
    if a is None or a <= 0: a = 0
    of_h.changeAttributeValue(f.id(),pi_h,1-(d/md_h))
    of_h.changeAttributeValue(f.id(),fi_h,(1-(d/md_h))*0.5+(a/ma_h)*0.5)
of_h.commitChanges()
processing.run("native:savefeatures",{"INPUT":of_h,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities_heath","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Step23 OK - HEATH DONE")

# Block 24: Clip Lowland Meadows to Chilterns
chil_lm = QgsVectorLayer(f"{OUT}|layername=chilterns_boundary","chilterns_boundary","ogr")
print(f"Chilterns (for Lowland Meadows) valid: {chil_lm.isValid()}, features: {chil_lm.featureCount()}")
lm = QgsVectorLayer(r"d:\새 폴더\Habitat_Networks_Individual_England.gpkg\Habitat_Networks_Individual_England.gpkg|layername=Lowland_Meadows","lm","ogr")
print(f"Lowland_Meadows valid: {lm.isValid()}, features: {lm.featureCount()}")
lmc = processing.run("native:clip",{"INPUT":lm,"OVERLAY":chil_lm,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":lmc,"OUTPUT":OUT,"LAYER_NAME":"Lowland_Meadows_chilterns","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: Lowland_Meadows_chilterns")
prj.removeMapLayer(lm.id())
lmc = QgsVectorLayer(f"{OUT}|layername=Lowland_Meadows_chilterns","Lowland_Meadows_chilterns","ogr")
prj.addMapLayer(lmc)
print(f"Step24 OK: {lmc.featureCount()} features")

# Block 25: Lowland Meadows centroids + lm_id
lc = processing.run("native:centroids",{"INPUT":lmc,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
lc.dataProvider().addAttributes([QgsField("lm_id",QVariant.Int)]);lc.updateFields()
li = lc.fields().indexOf("lm_id")
lc.startEditing()
i = 1
for f in lc.getFeatures():
    lc.changeAttributeValue(f.id(),li,i)
    i += 1
lc.commitChanges()
processing.run("native:savefeatures",{"INPUT":lc,"OUTPUT":OUT,"LAYER_NAME":"LM_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: LM_centroids")
lc = QgsVectorLayer(f"{OUT}|layername=LM_centroids","LM_centroids","ogr")
print(f"Step25 OK: {lc.featureCount()} centroids")

# Block 26: Gap (AW buffer - Lowland Meadows)
ab_lm = QgsVectorLayer(f"{OUT}|layername=AW_250m_buffer","AW_250m_buffer","ogr")
lmc = QgsVectorLayer(f"{OUT}|layername=Lowland_Meadows_chilterns","Lowland_Meadows_chilterns","ogr")
gap_lm = processing.run("native:difference",{"INPUT":ab_lm,"OVERLAY":lmc,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":gap_lm,"OUTPUT":OUT,"LAYER_NAME":"gap_lm_raw","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_lm_raw")
gap_lm = QgsVectorLayer(f"{OUT}|layername=gap_lm_raw","gap_lm_raw","ogr")
print(f"Step26 OK: {gap_lm.featureCount()} features")

# Block 27: Gap x PHI for Lowland Meadows
phic_lm = QgsVectorLayer(f"{OUT}|layername=PHI_chilterns","PHI_chilterns","ogr")
gp_lm = processing.run("native:intersection",{"INPUT":gap_lm,"OVERLAY":phic_lm,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
gp_lm.dataProvider().addAttributes([QgsField("area_ha_lm",QVariant.Double)]);gp_lm.updateFields()
ahi_lm = gp_lm.fields().indexOf("area_ha_lm")
gp_lm.startEditing()
for f in gp_lm.getFeatures():
    gp_lm.changeAttributeValue(f.id(),ahi_lm,f.geometry().area()/10000.0)
gp_lm.commitChanges()
processing.run("native:savefeatures",{"INPUT":gp_lm,"OUTPUT":OUT,"LAYER_NAME":"gap_lm_phi","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: gap_lm_phi")
gp_lm = QgsVectorLayer(f"{OUT}|layername=gap_lm_phi","gap_lm_phi","ogr")
prj.addMapLayer(gp_lm)
print(f"Step27 OK: {gp_lm.featureCount()} features")

# Block 28: Suitable habitats (Lowland Meadows)
su_lm = processing.run("native:extractbyexpression",{"INPUT":gp_lm,"EXPRESSION":"\"MainHabs\" IS NOT NULL","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":su_lm,"OUTPUT":OUT,"LAYER_NAME":"AW_LM_opportunities","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_LM_opportunities")
su_lm = QgsVectorLayer(f"{OUT}|layername=AW_LM_opportunities","AW_LM_opportunities","ogr")
prj.addMapLayer(su_lm)
print(f"Step28 OK: {su_lm.featureCount()} features")

# Block 29: LM opportunities to Lowland Meadows distance
lc = QgsVectorLayer(f"{OUT}|layername=LM_centroids","LM_centroids","ogr")
oc_lm = processing.run("native:centroids",{"INPUT":su_lm,"ALL_PARTS":False,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":oc_lm,"OUTPUT":OUT,"LAYER_NAME":"lm_opp_centroids","ACTION_ON_EXISTING_FILE":1},feedback=fb)
oc_lm = QgsVectorLayer(f"{OUT}|layername=lm_opp_centroids","lm_opp_centroids","ogr")
dm2_lm = processing.run("qgis:distancematrix",{"INPUT":oc_lm,"INPUT_FIELD":"fid","TARGET":lc,"TARGET_FIELD":"lm_id","NEAREST_POINTS":1,"MATRIX_TYPE":0,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
oj_lm = processing.run("native:joinattributestable",{"INPUT":oc_lm,"FIELD":"fid","INPUT_2":dm2_lm,"FIELD_2":"InputID","OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
ow_lm = processing.run("native:joinattributesbylocation",{"INPUT":su_lm,"JOIN":oj_lm,"PREDICATE":[0],"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
processing.run("native:savefeatures",{"INPUT":ow_lm,"OUTPUT":OUT,"LAYER_NAME":"lm_opp_with_distance","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: lm_opp_with_distance")
ow_lm = QgsVectorLayer(f"{OUT}|layername=lm_opp_with_distance","lm_opp_with_distance","ogr")
print("Step29 OK")

# Block 30: Remove roads (Lowland Meadows) and compute area
rb_lm = QgsVectorLayer(f"{OUT}|layername=road_10m_buffer","road_10m_buffer","ogr")
of_lm = processing.run("native:difference",{"INPUT":ow_lm,"OVERLAY":rb_lm,"OUTPUT":"memory:"},feedback=fb)["OUTPUT"]
of_lm.dataProvider().addAttributes([
    QgsField("area_ha_fin_lm",QVariant.Double),
    QgsField("priority_lm",QVariant.Double),
    QgsField("final_sc_lm",QVariant.Double)
]);of_lm.updateFields()
afi_lm = of_lm.fields().indexOf("area_ha_fin_lm")
of_lm.startEditing()
for f in of_lm.getFeatures():
    of_lm.changeAttributeValue(f.id(),afi_lm,f.geometry().area()/10000.0)
of_lm.commitChanges()
processing.run("native:savefeatures",{"INPUT":of_lm,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities_meadows","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Saved: AW_final_opportunities_meadows")
of_lm = QgsVectorLayer(f"{OUT}|layername=AW_final_opportunities_meadows","AW_final_opportunities_meadows","ogr")
prj.addMapLayer(of_lm)
print(f"Step30 OK: {of_lm.featureCount()} features")

# Block 31: Final score (Lowland Meadows)
md_lm = 1; ma_lm = 1
for f in of_lm.getFeatures():
    d = f["Distance"]; a = f["area_ha_fin_lm"]
    if d is not None and d > md_lm: md_lm = d
    if a is not None and a > ma_lm: ma_lm = a
print(f"LM Max Dist: {md_lm}, Max Area: {ma_lm}")
pi_lm = of_lm.fields().indexOf("priority_lm")
fi_lm = of_lm.fields().indexOf("final_sc_lm")
of_lm.startEditing()
for f in of_lm.getFeatures():
    d = f["Distance"]; a = f["area_ha_fin_lm"]
    if d is None or d <= 0: d = md_lm
    if a is None or a <= 0: a = 0
    of_lm.changeAttributeValue(f.id(),pi_lm,1-(d/md_lm))
    of_lm.changeAttributeValue(f.id(),fi_lm,(1-(d/md_lm))*0.5+(a/ma_lm)*0.5)
of_lm.commitChanges()
processing.run("native:savefeatures",{"INPUT":of_lm,"OUTPUT":OUT,"LAYER_NAME":"AW_final_opportunities_meadows","ACTION_ON_EXISTING_FILE":1},feedback=fb)
print("Step31 OK - LOWLAND MEADOWS DONE")