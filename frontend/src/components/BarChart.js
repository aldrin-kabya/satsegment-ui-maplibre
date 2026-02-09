'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend as ChartLegend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { LULC_CLASSES } from './constants';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, ChartLegend, ChartDataLabels);

const PATHS = {
  "2019": "/media/drive2/armun/sat-segment/processed_cog/2019_cog.tif",
  "2023": "/media/drive2/armun/sat-segment/processed_cog/2023_cog.tif"
};

export default function BarChart({ map, year, activeLayer, apiUrl, selectedRegion }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  const fetchStats = useCallback(async () => {
    if (!map && !selectedRegion) return;

    try {
      setLoading(true);
      let res;

      if (selectedRegion && selectedRegion.geometries) {
        // POST for specific region
        const geom = selectedRegion.geometries[0];
        res = await fetch(`${apiUrl}/exact_stats_geojson`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: PATHS[year],
            geojson: { type: "Feature", geometry: geom }
          })
        });
      } else {
        // GET for Viewport
        const bounds = map.getBounds();
        const bbox = [
          bounds.getWest().toFixed(4), bounds.getSouth().toFixed(4),
          bounds.getEast().toFixed(4), bounds.getNorth().toFixed(4)
        ].join(',');
        const url = `${apiUrl}/exact_stats?url=${PATHS[year]}&bbox=${bbox}&_t=${Date.now()}`;
        res = await fetch(url);
      }

      if (!res.ok) { setDebugMsg(`HTTP ${res.status}`); setLoading(false); return; }

      const json = await res.json();
      const counts = json.counts || {};

      let total = 0;
      Object.keys(counts).forEach(k => { if (String(k) !== "0") total += counts[k]; });

      if (total === 0) {
        setDebugMsg("No Data"); setChartData([]); setLoading(false); return;
      }

      const processedData = LULC_CLASSES.map(cls => {
        const val = counts[cls.id.toString()] || 0;
        return { name: cls.name, color: cls.color, percentage: (val / total) * 100 };
      });

      setChartData(processedData);
      setLoading(false);
      setDebugMsg("");

    } catch (err) {
      console.error(err); setDebugMsg("Error"); setLoading(false);
    }
  }, [map, year, apiUrl, selectedRegion]);

  useEffect(() => {
    if (selectedRegion) {
      fetchStats();
      if (map) map.off('moveend', fetchStats);
      return;
    }
    if (!map) return;
    fetchStats();
    let timeoutId;
    const onMoveEnd = () => { clearTimeout(timeoutId); timeoutId = setTimeout(fetchStats, 100); };
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); clearTimeout(timeoutId); };
  }, [map, fetchStats, selectedRegion]);

  const barShadowPlugin = {
    id: 'barShadow',
    beforeDatasetDraw: (chart) => {
      const { ctx } = chart; ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    },
    afterDatasetDraw: (chart) => { chart.ctx.restore(); }
  };

  // --- TITLE LOGIC ---
  const getTitle = () => {
    if (selectedRegion && selectedRegion.name) {
      return `${selectedRegion.name} ${year}`;
    }
    return `Land Cover ${year}`;
  };

  if (!chartData.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center opacity-70">
        <h3 style={{ fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '16px', textAlign: 'center', color: '#333' }}>{getTitle()}</h3>
        <div className="text-xs text-gray-500 py-8">
          {loading ? <span className="animate-pulse">Calculating...</span> : <span>{debugMsg || "No Data"}</span>}
        </div>
      </div>
    );
  }

  const data = {
    labels: chartData.map(d => d.name),
    datasets: [{
      data: chartData.map(d => d.percentage),
      backgroundColor: chartData.map(d => {
        const isActive = activeLayer === 'all' || (d.name.toLowerCase().replace(' ', '-') === activeLayer);
        return isActive ? d.color : 'rgba(180, 180, 180, 0.5)';
      }),
      borderColor: chartData.map(d => {
        const isActive = activeLayer === 'all' || (d.name.toLowerCase().replace(' ', '-') === activeLayer);
        return isActive ? '#333' : 'rgba(180, 180, 180, 0.8)';
      }),
      borderWidth: 0,
      borderRadius: 8,
      barPercentage: 0.8,
    }]
  };

  const options = {
    responsive: true, maintainAspectRatio: true,
    layout: {
      padding: { top: 15 } // Prevent top label clip
    },
    plugins: {
      legend: { display: false },
      // --- FIX 2: ENABLE TOOLTIPS ---
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 13 },
        bodyFont: { size: 13 },
        padding: 10,
        cornerRadius: 4,
        callbacks: {
          title: (items) => items[0].label, // Show Class Name
          label: (context) => ` ${context.parsed.y.toFixed(2)}%` // Precise value on hover
        }
      },
      datalabels: {
        anchor: 'end', align: 'end', offset: -2,
        // --- FIX 1: 1 DECIMAL PLACE ---
        formatter: (value) => {
          if (value === 0) return "";
          return `${value.toFixed(1)}%`;
        },
        font: { size: 11, weight: '500' },
        color: (context) => {
          const clsName = context.chart.data.labels[context.dataIndex];
          const isActive = activeLayer === 'all' || (clsName.toLowerCase().replace(' ', '-') === activeLayer);
          return isActive ? '#333' : 'rgba(180, 180, 180, 0.9)';
        }
      }
    },
    scales: {
      y: { display: false, max: 100 },
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 0, minRotation: 0, autoSkip: false,
          font: (context) => { const width = context.chart.width; return { size: width < 220 ? 8 : 11 }; }
        }
      }
    },
    animation: { duration: 500 }
  };

  return (
    <div className="w-full h-full">
      <h3 style={{ fontWeight: 'bold', margin: '0 0 8px 0', fontSize: '16px', textAlign: 'center', color: '#333' }}>
        {getTitle()}
      </h3>
      <Bar data={data} options={options} plugins={[barShadowPlugin]} />
    </div>
  );
}