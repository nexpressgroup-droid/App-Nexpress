import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, SafeAreaView, Alert, Linking, PanResponder, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [empresa, setEmpresa] = useState('');
  const [att, setAtt] = useState('');
  const [calle, setCalle] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [observacion, setObservacion] = useState('');
  const [ordenDe, setOrdenDe] = useState('');
  
  // Campos para Aclaración y DNI
  const [aclaracionNombre, setAclaracionNombre] = useState('');
  const [aclaracionDni, setAclaracionDni] = useState('');

  // Control del Modal de Firma
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);

  // Estados para la firma en SVG
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [firmaSvgString, setFirmaSvgString] = useState('');

  // Referencias para posición exacta en pantalla (elimina el desfasaje/desplazamiento)
  const canvasRef = useRef(null);
  const canvasBounds = useRef({ x: 0, y: 0, width: 300, height: 200 });
  const [canvasLayout, setCanvasLayout] = useState({ width: 300, height: 200 });

  useEffect(() => {
    cargarDatosLocales();
  }, []);

  const medirCanvas = () => {
    if (canvasRef.current) {
      canvasRef.current.measureInWindow((x, y, width, height) => {
        canvasBounds.current = { x, y, width, height };
        setCanvasLayout({ width, height });
      });
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const relX = pageX - canvasBounds.current.x;
      const relY = pageY - canvasBounds.current.y;
      setCurrentPath(`M ${relX.toFixed(1)} ${relY.toFixed(1)}`);
    },
    onPanResponderMove: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const relX = pageX - canvasBounds.current.x;
      const relY = pageY - canvasBounds.current.y;
      setCurrentPath((prev) => `${prev} L ${relX.toFixed(1)} ${relY.toFixed(1)}`);
    },
    onPanResponderRelease: () => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        setCurrentPath('');
      }
    },
  });

  const guardarFirmaModal = () => {
    if (paths.length === 0 && !currentPath) {
      Alert.alert("Aviso", "Por favor dibuje su firma primero.");
      return;
    }
    
    const allPaths = [...paths, currentPath].filter(Boolean);
    const svgData = `<svg width="${canvasLayout.width}" height="${canvasLayout.height}" viewBox="0 0 ${canvasLayout.width} ${canvasLayout.height}" xmlns="http://www.w3.org/2000/svg">${allPaths.map(p => `<path d="${p}" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    
    setFirmaSvgString(svgData);
    setModalFirmaVisible(false);
    Alert.alert("¡Éxito!", "Firma registrada correctamente.");
  };

  const borrarFirma = () => {
    setPaths([]);
    setCurrentPath('');
    setFirmaSvgString('');
  };

  const guardarDatosLocales = async () => {
    try {
      const datosRemito = { empresa, att, calle, localidad, observacion, ordenDe, aclaracionNombre, aclaracionDni };
      await AsyncStorage.setItem('@Nexpress_Remito', JSON.stringify(datosRemito));
      Alert.alert("Guardado", "Los datos del remito se guardaron localmente.");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar localmente.");
    }
  };

  const cargarDatosLocales = async () => {
    try {
      const datos = await AsyncStorage.getItem('@Nexpress_Remito');
      if (datos !== null) {
        const parsed = JSON.parse(datos);
        setEmpresa(parsed.empresa || '');
        setAtt(parsed.att || '');
        setCalle(parsed.calle || '');
        setLocalidad(parsed.localidad || '');
        setObservacion(parsed.observacion || '');
        setOrdenDe(parsed.ordenDe || '');
        setAclaracionNombre(parsed.aclaracionNombre || '');
        setAclaracionDni(parsed.aclaracionDni || '');
      }
    } catch (e) {
      // Manejo de error
    }
  };

  const abrirRastreoMapa = () => {
    if (!calle && !localidad) {
      Alert.alert("Aviso", "Por favor ingresa al menos una calle o localidad para buscar en el mapa.");
      return;
    }
    const textoDireccion = calle + ", " + localidad + ", Argentina";
    const direccionBusqueda = encodeURIComponent(textoDireccion);
    const url = "https://www.google.com/maps/search/?api=1&query=" + direccionBusqueda;
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir el mapa."));
  };

  const enviarPorWhatsApp = () => {
    if (!empresa) {
      Alert.alert("Aviso", "Por favor ingresa al menos el campo Empresa antes de enviar.");
      return;
    }

    const mensaje = 
      `*REMITO DIGITAL - NEXPRESS GROUP*\n` +
      `*Tel:* 116740-2801\n\n` +
      `*Empresa:* ${empresa}\n` +
      `*Att:* ${att}\n` +
      `*Dirección:* ${calle}, ${localidad}\n` +
      `*Observación:* ${observacion}\n` +
      `*Por orden de:* ${ordenDe}\n\n` +
      `-------------------------\n` +
      `*RECIBIDO POR:*\n` +
      `*Nombre:* ${aclaracionNombre}\n` +
      `*DNI:* ${aclaracionDni}\n` +
      `*Estado Firma:* ${firmaSvgString ? 'Firmado ✓' : 'Pendiente ❌'}`;

    const url = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir WhatsApp. Asegúrate de tener la app instalada.");
    });
  };

  const generarYCompartirPDF = async () => {
    const htmlContent = `
      <html>
        <head>
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, Helvetica, sans-serif;
              background-color: #ffffff;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .remito-card {
              width: 850px;
              height: 520px;
              background-color: #fbdada;
              border: 1px solid #d32f2f;
              position: relative;
              box-sizing: border-box;
              padding: 20px;
            }

            .sidebar-text {
              position: absolute;
              left: 15px;
              bottom: 40px;
              transform: rotate(-90deg);
              transform-origin: left bottom;
              color: #d32f2f;
              font-weight: bold;
              font-size: 14px;
              white-space: nowrap;
            }

            .header-right {
              position: absolute;
              top: 20px;
              right: 25px;
              text-align: right;
            }
            .logo-title {
              color: #d32f2f;
              font-size: 38px;
              font-weight: 900;
              letter-spacing: -1px;
              margin: 0;
              line-height: 0.9;
            }
            .sub-title {
              color: #d32f2f;
              font-size: 12px;
              font-weight: bold;
              letter-spacing: 1px;
              margin-top: 5px;
              border-bottom: 2px solid #d32f2f;
              display: inline-block;
              padding-bottom: 2px;
            }
            .phones {
              color: #d32f2f;
              font-size: 26px;
              font-weight: 900;
              line-height: 1.1;
              margin-top: 10px;
            }
            .web-info {
              color: #d32f2f;
              font-size: 12px;
              font-weight: bold;
              margin-top: 10px;
            }

            .box-white {
              position: absolute;
              top: 150px;
              left: 200px;
              width: 615px;
              height: 200px;
              background-color: #ffffff;
              padding: 15px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-around;
            }
            .field-row {
              font-size: 16px;
              color: #d32f2f;
              font-weight: bold;
            }
            .field-value {
              color: #000000;
              font-weight: normal;
              margin-left: 10px;
            }

            .footer-section {
              position: absolute;
              bottom: 25px;
              left: 200px;
              width: 615px;
              color: #d32f2f;
              font-size: 14px;
              font-weight: bold;
            }
            .line-input {
              border-bottom: 2px solid #d32f2f;
              display: inline-block;
              width: 380px;
              color: #000;
              padding-left: 10px;
              font-weight: normal;
            }
            .signatures-row {
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
              text-align: center;
              align-items: flex-end;
            }
            .sig-box {
              width: 45%;
              border-top: 2px solid #d32f2f;
              padding-top: 5px;
              color: #d32f2f;
              position: relative;
            }
            .signature-svg-box {
              height: 60px;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .aclaracion-box {
              height: 60px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              color: #000;
              font-size: 13px;
              font-weight: bold;
            }
            .bottom-row {
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="remito-card">
            
            <div class="sidebar-text">
              NEXPRESS GROUP S.R.L. &nbsp;&nbsp; 116740-2801 &nbsp;&nbsp; info@nexpressgroup.com.ar
            </div>

            <div class="header-right">
              <div class="logo-title">NEXPRESS GROUP</div>
              <div class="sub-title">Mensajeria Urbana</div>
              <div class="phones">
                116740-2801
              </div>
              <div class="web-info">info@nexpressgroup.com.ar &nbsp;-&nbsp; www.nexpressgroup.com.ar</div>
            </div>

            <div class="box-white">
              <div class="field-row">Empresa <span class="field-value">${empresa}</span></div>
              <div class="field-row">Att. Señor/a <span class="field-value">${att}</span></div>
              <div class="field-row">Calle <span class="field-value">${calle}</span></div>
              <div class="field-row">Localidad <span class="field-value">${localidad}</span></div>
              <div class="field-row">Observacion <span class="field-value">${observacion}</span></div>
            </div>

            <div class="footer-section">
              <div>Remitimos a Uds. Por orden de: <span class="line-input">${ordenDe}</span></div>
              
              <div class="signatures-row">
                <div class="sig-box">
                  <div class="signature-svg-box">
                    ${firmaSvgString ? firmaSvgString : ''}
                  </div>
                  FIRMA
                </div>
                <div class="sig-box">
                  <div class="aclaracion-box">
                    <div>${aclaracionNombre ? aclaracionNombre : ''}</div>
                    <div>${aclaracionDni ? 'DNI: ' + aclaracionDni : ''}</div>
                  </div>
                  SELLO O ACLARACION
                </div>
              </div>

              <div class="bottom-row">
                <div>Recibido Fecha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /</div>
                <div>Teléfono: _______________________</div>
              </div>
            </div>

          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert("Error", "No se pudo generar el PDF del remito.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={true}>
        
        <View style={styles.header}>
          <Text style={styles.logoText}>NEXPRESS <Text style={styles.groupText}>GROUP</Text></Text>
          <Text style={styles.subLogo}>LOGISTICA EMPRESARIAL S.R.L.</Text>
          <Text style={styles.phoneText}>116740-2801</Text>
        </View>

        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Empresa" placeholderTextColor="#ff8888" value={empresa} onChangeText={setEmpresa} />
          <TextInput style={styles.input} placeholder="Att. Señor/a" placeholderTextColor="#ff8888" value={att} onChangeText={setAtt} />
          <TextInput style={styles.input} placeholder="Calle" placeholderTextColor="#ff8888" value={calle} onChangeText={setCalle} />
          <TextInput style={styles.input} placeholder="Localidad" placeholderTextColor="#ff8888" value={localidad} onChangeText={setLocalidad} />
          <TextInput style={styles.input} placeholder="Observacion" placeholderTextColor="#ff8888" value={observacion} onChangeText={setObservacion} />
        </View>

        <TouchableOpacity style={styles.trackButton} onPress={abrirRastreoMapa}>
          <Text style={styles.trackButtonText}>MAPA RASTREO EN TIEMPO REAL</Text>
        </TouchableOpacity>

        <View style={styles.footerSection}>
          <Text style={styles.footerLabel}>Remitimos a Uds. Por orden de:</Text>
          <TextInput style={styles.smallInput} placeholder="Orden de..." placeholderTextColor="#ff8888" value={ordenDe} onChangeText={setOrdenDe} />

          {/* Botón para Abrir Modal de Firma */}
          <Text style={styles.sectionTitle}>Firma Digital:</Text>
          <TouchableOpacity 
            style={[styles.modalOpenBtn, firmaSvgString ? styles.btnFirmado : null]} 
            onPress={() => setModalFirmaVisible(true)}
          >
            <Text style={styles.modalOpenBtnText}>
              {firmaSvgString ? '✓ Firma Capturada (Tocar para modificar)' : '✍️ Abrir Pantalla de Firma'}
            </Text>
          </TouchableOpacity>

          {/* Aclaración (Nombre y DNI) */}
          <Text style={styles.sectionTitle}>Aclaración y DNI:</Text>
          <TextInput style={styles.smallInput} placeholder="Nombre y Apellido" placeholderTextColor="#ff8888" value={aclaracionNombre} onChangeText={setAclaracionNombre} />
          <TextInput style={styles.smallInput} placeholder="DNI" placeholderTextColor="#ff8888" keyboardType="numeric" value={aclaracionDni} onChangeText={setAclaracionDni} />

          <TouchableOpacity style={styles.actionBtnFull} onPress={guardarDatosLocales}>
            <Text style={styles.actionBtnText}>💾 Guardar Datos en Celular</Text>
          </TouchableOpacity>

          {/* Botón WhatsApp */}
          <TouchableOpacity style={styles.whatsappBtn} onPress={enviarPorWhatsApp}>
            <Text style={styles.whatsappBtnText}>💬 Enviar Reporte por WhatsApp</Text>
          </TouchableOpacity>

          {/* Botón PDF */}
          <TouchableOpacity style={styles.pdfButton} onPress={generarYCompartirPDF}>
            <Text style={styles.pdfButtonText}>📄 Generar Remito PDF (Con Firma e Impresión)</Text>
          </TouchableOpacity>

          {/* Firma de Autor / Firma de Software */}
          <Text style={styles.brandingText}>by neomaxsoft</Text>
        </View>

      </ScrollView>

      {/* VENTANA MODAL APARTE PARA FIRMAR */}
      <Modal animationType="slide" transparent={false} visible={modalFirmaVisible} onShow={medirCanvas} onRequestClose={() => setModalFirmaVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Firme en el recuadro (Gira el celu si querés)</Text>
            <TouchableOpacity onPress={() => setModalFirmaVisible(false)}>
              <Text style={styles.closeModalText}>❌ Cancelar</Text>
            </TouchableOpacity>
          </View>

          <View 
            ref={canvasRef}
            style={styles.modalCanvasContainer} 
            onLayout={medirCanvas} 
            {...panResponder.panHandlers}
          >
            <Svg height="100%" width="100%" viewBox={`0 0 ${canvasLayout.width} ${canvasLayout.height}`}>
              {paths.map((d, index) => (
                <Path key={index} d={d} stroke="black" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath ? (
                <Path d={currentPath} stroke="black" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
          </View>

          <View style={styles.modalButtonsRow}>
            <TouchableOpacity style={styles.modalBtnDelete} onPress={borrarFirma}>
              <Text style={styles.modalBtnText}>🗑️ Borrar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalBtnSave} onPress={guardarFirmaModal}>
              <Text style={styles.modalBtnText}>✓ Guardar Firma</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0202' },
  scroll: { padding: 15, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ff2222', paddingBottom: 10 },
  logoText: { color: '#ff3333', fontSize: 22, fontWeight: 'bold' },
  groupText: { fontSize: 14, color: '#ff8888' },
  subLogo: { color: '#ff8888', fontSize: 10, letterSpacing: 1, marginBottom: 5 },
  phoneText: { color: '#ff5555', fontSize: 14, fontWeight: 'bold' },
  formCard: { borderWidth: 1.5, borderColor: '#ff3333', borderRadius: 10, padding: 10, backgroundColor: '#120404', marginBottom: 20 },
  input: { borderBottomWidth: 1, borderBottomColor: '#ff4444', color: '#fff', paddingVertical: 8, marginBottom: 12, fontSize: 14 },
  trackButton: { borderWidth: 2, borderColor: '#ff2222', borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginBottom: 20, backgroundColor: '#1a0000' },
  trackButtonText: { color: '#ff3333', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
  footerSection: { borderTopWidth: 1, borderTopColor: '#ff2222', paddingTop: 15 },
  footerLabel: { color: '#ff8888', marginBottom: 8 },
  smallInput: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 8, color: '#fff', padding: 8, marginBottom: 15 },
  sectionTitle: { color: '#ffaaaa', fontWeight: 'bold', marginBottom: 8, fontSize: 13 },
  modalOpenBtn: { borderWidth: 2, borderColor: '#ff4444', borderRadius: 8, padding: 15, alignItems: 'center', backgroundColor: '#200505', marginBottom: 15 },
  modalOpenBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  actionBtnFull: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 8, padding: 12, alignItems: 'center', backgroundColor: '#150505', marginBottom: 10 },
  btnFirmado: { backgroundColor: '#003300', borderColor: '#00ff00' },
  actionBtnText: { color: '#ff6666', fontSize: 12, fontWeight: 'bold' },
  whatsappBtn: { borderWidth: 2, borderColor: '#25D366', borderRadius: 10, padding: 15, alignItems: 'center', backgroundColor: '#075E54', marginBottom: 10 },
  whatsappBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  pdfButton: { borderWidth: 2, borderColor: '#ff3333', borderRadius: 10, padding: 15, alignItems: 'center', backgroundColor: '#330000', marginTop: 5, marginBottom: 20 },
  pdfButtonText: { color: '#ffaaaa', fontWeight: 'bold', fontSize: 14 },
  brandingText: { textAlign: 'center', color: '#666666', fontSize: 12, marginTop: 15, marginBottom: 25, fontStyle: 'italic' },
  modalContainer: { flex: 1, backgroundColor: '#0a0202', padding: 15, justifyContent: 'space-between' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  closeModalText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14 },
  modalCanvasContainer: { flex: 1, borderRadius: 10, borderWidth: 2, borderColor: '#ff3333', backgroundColor: '#ffffff', marginBottom: 15 },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalBtnDelete: { flex: 0.45, padding: 15, backgroundColor: '#330000', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ff4444' },
  modalBtnSave: { flex: 0.5, padding: 15, backgroundColor: '#004d00', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00ff00' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 }
});