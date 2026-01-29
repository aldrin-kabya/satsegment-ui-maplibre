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
// Note: We don't import CSS here anymore, Map.js handles the container style

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, ChartLegend, ChartDataLabels);

const PATHS = {
  "2019": "/media/drive2/armun/sat-segment/processed_cog/2019_cog.tif",
  "2023": "/media/drive2/armun/sat-segment/processed_cog/2023_cog.tif"
};

export default function BarChart({ map, year, activeLayer, apiUrl }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  const fetchStats = useCallback(async () => {
    if (!map) return;

    try {
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest().toFixed(4),
        bounds.getSouth().toFixed(4),
        bounds.getEast().toFixed(4),
        bounds.getNorth().toFixed(4)
      ].join(',');

      const url = `${apiUrl}/exact_stats?url=${PATHS[year]}&bbox=${bbox}&_t=${Date.now()}`;
      
      setLoading(true);
      
      const res = await fetch(url);
      if (!res.ok) {
        setDebugMsg(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      
      const json = await res.json();
      const counts = json.counts || {};

      let total = 0;
      Object.keys(counts).forEach(k => {
        if (String(k) !== "0") total += counts[k];
      });

      if (total === 0) {
        setDebugMsg("No Data");
        setChartData([]);
        setLoading(false);
        return;
      }

      const processedData = LULC_CLASSES.map(cls => {
        const val = counts[cls.id.toString()] || 0;
        return {
          name: cls.name,
          color: cls.color,
          percentage: (val / total) * 100
        };
      });

      setChartData(processedData);
      setLoading(false);
      setDebugMsg("");

    } catch (err) {
      console.error(err);
      setDebugMsg("Error");
      setLoading(false);
    }
  }, [map, year, apiUrl]);

  useEffect(() => {
    if (!map) return;
    fetchStats();
    let timeoutId;
    const onMoveEnd = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(fetchStats, 100); 
    };
    map.on('moveend', onMoveEnd);
    return () => { 
        map.off('moveend', onMoveEnd);
        clearTimeout(timeoutId);
    };
  }, [map, fetchStats]);

  const barShadowPlugin = {
    id: 'barShadow',
    beforeDatasetDraw: (chart) => {
      const { ctx } = chart;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    },
    afterDatasetDraw: (chart) => {
      chart.ctx.restore();
    }
  };

  // --- RENDER CONTENT ONLY (Wrapper handles the Box) ---
  if (!chartData.length) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center opacity-70">
            <h3 style={{fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '16px', textAlign: 'center', color: '#333'}}>Land Cover {year}</h3>
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
        const isActive = activeLayer === 'all' || 
                         (d.name.toLowerCase().replace(' ', '-') === activeLayer) ||
                         (activeLayer === 'built-up' && d.name === 'Urban');
        return isActive ? d.color : 'rgba(180, 180, 180, 0.5)';
      }),
      borderColor: chartData.map(d => {
        const isActive = activeLayer === 'all' || 
                         (d.name.toLowerCase().replace(' ', '-') === activeLayer) ||
                         (activeLayer === 'built-up' && d.name === 'Urban');
        return isActive ? '#333' : 'rgba(180, 180, 180, 0.8)';
      }),
      borderWidth: 0,
      borderRadius: 8,
      barPercentage: 0.8,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true, 
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: -2,
        formatter: (value) => `${value.toFixed(0)}%`,
        font: { size: 11, weight: '500' },
        color: (context) => {
          const clsName = context.chart.data.labels[context.dataIndex];
          const isActive = activeLayer === 'all' || 
                           (clsName.toLowerCase().replace(' ', '-') === activeLayer) ||
                           (activeLayer === 'built-up' && clsName === 'Urban');
          return isActive ? '#333' : 'rgba(180, 180, 180, 0.9)';
        }
      }
    },
    scales: {
      y: { display: false, max: Math.max(...chartData.map(d => d.percentage)) + 14 }, 
      x: { 
        grid: { display: false },
        ticks: { 
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: (context) => {
             const width = context.chart.width;
             return { size: width < 220 ? 8 : 11 };
          }
        }
      }
    },
    animation: { duration: 500 }
  };

  return (
    <div className="w-full h-full">
      <h3 style={{fontWeight: 'bold', margin: '0 0 8px 0', fontSize: '16px', textAlign: 'center', color: '#333'}}>Land Cover Totals {year}</h3>
      <Bar data={data} options={options} plugins={[barShadowPlugin]} />
    </div>
  );
}