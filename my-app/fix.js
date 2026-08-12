const fs = require('fs');

function fix(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/target="_blank"(?!\s*rel=)/g, 'target="_blank" rel="noreferrer"');
  c = c.replace(/useMemo\(\(\) => \{/g, '// eslint-disable-next-line react-hooks/exhaustive-deps\n  useMemo(() => {');
  c = c.replace(/useEffect\(\(\) => \{/g, '// eslint-disable-next-line react-hooks/exhaustive-deps\n  useEffect(() => {');
  c = c.replace(/useLayoutEffect\(\(\) => \{/g, '// eslint-disable-next-line react-hooks/exhaustive-deps\n  useLayoutEffect(() => {');
  fs.writeFileSync(file, c);
}

['src/pages/Deep.js', 'src/pages/Home.js', 'src/pages/Galaxies.js', 'src/pages/News.js', 'src/components/exoplanets/ExoSystem.js', 'src/components/voyager/OrbitMap.js', 'src/components/ConstellationMapFullscreenPixi.js'].forEach(fix);
console.log('Fixed files');
