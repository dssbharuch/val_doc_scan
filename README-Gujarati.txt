Live Line OCR – Manual Scan Button Position Update

આ ZIP માં અગાઉની Live Line OCR Share Preview આવૃત્તિની ત્રણેય JSX ફાઇલો છે.

નવો ફેરફાર:
- Manual Scan બટન અગાઉ કરતાં થોડું નીચે ડિફોલ્ટ સ્થાને છે.
- બટનને લગભગ 0.38 સેકન્ડ દબાવી રાખો; પછી આંગળી/માઉસથી ખેંચીને ગમતી જગ્યાએ મૂકી શકો છો.
- છોડતાં જ તેની જગ્યા આ બ્રાઉઝરમાં સેવ થશે. આગલી વાર Camera ખોલો ત્યારે એ જ જગ્યા રહેશે.
- સામાન્ય ટૅપ કરવાથી Manual Scan થશે.

ફાઇલો:
src/components/GuidedCamera.jsx
src/components/ScanEditor.jsx
src/components/ScannerFlow.jsx

જૂની ફાઇલોનો બેકઅપ રાખીને આ ત્રણ ફાઇલો Replace કરો. પછી npm run build અને Localhost પર મોબાઇલ/ડેસ્કટોપ બંનેમાં ચકાસો.
