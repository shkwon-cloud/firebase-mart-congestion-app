document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('congestion-form');
    const dateInput = document.getElementById('date');
    const resultsContainer = document.getElementById('results-container');
    const resultsTitle = document.getElementById('results-title');
    const weatherInfoElement = document.getElementById('weather-info'); // New element
    const resultsList = document.getElementById('results-list');

    // Set default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const regionValue = form.region.value;
        const regionText = form.region.options[form.region.selectedIndex].text; // Get text for display
        const mart = form.mart.options[form.mart.selectedIndex];
        const martValue = mart.value;
        const martText = mart.text;
        const date = new Date(dateInput.value);

        resultsContainer.classList.remove('hidden');
        resultsList.innerHTML = '<li>데이터를 불러오는 중입니다...</li>';
        resultsTitle.textContent = '';
        weatherInfoElement.textContent = '날씨 정보 불러오는 중...'; // Clear and show loading for weather

        try {
            // Call both APIs in parallel using Promise.allSettled
            const [congestionResult, weatherResult] = await Promise.allSettled([
                fetchCongestionFromAPI(regionValue, martValue, date),
                fetchTemperatureFromAPI(regionValue, date) // New API call
            ]);

            let congestionData;
            if (congestionResult.status === 'fulfilled') {
                congestionData = congestionResult.value;
            } else {
                console.warn('API fetch failed, using fallback model:', congestionResult.reason);
                congestionData = getFallbackCongestionData(martValue, date);
            }

            let weatherData = null;
            if (weatherResult.status === 'fulfilled') {
                weatherData = weatherResult.value;
            } else {
                console.warn('Weather API fetch failed:', weatherResult.reason);
            }
            
            // Pass weatherData to renderResults
            renderResults(congestionData, weatherData, regionText, martText, date);

        } catch (error) {
            // This catch block would only be hit if Promise.allSettled itself rejects,
            // which should not happen. Individual promise rejections are handled within
            // the allSettled results.
            console.error("An unexpected error occurred:", error);
            resultsList.innerHTML = '<li>오류가 발생했습니다.</li>';
            weatherInfoElement.textContent = '';
        }
    });

    /**
     * Fetches congestion data from the (simulated) Cloudflare API.
     * This function is designed to fail to demonstrate the fallback mechanism.
     */
    function fetchCongestionFromAPI(regionValue, martValue, date) {
        // API Success Simulation Condition
        if (regionValue === 'seoul_yangjae' && martValue === 'costco') {
            console.log('API success condition met. Returning simulated API data.');
            
            // This is mock data, visibly different from the fallback model
            const mockApiData = {
                source: 'API',
                hourly_congestion: [
                    { hour: 10, level: '원활', levelClass: 'level-1' },
                    { hour: 11, level: '보통', levelClass: 'level-2' },
                    { hour: 12, level: '혼잡', levelClass: 'level-3' },
                    { hour: 13, level: '혼잡', levelClass: 'level-3' },
                    { hour: 14, level: '매우 혼잡', levelClass: 'level-4' }, // Different peak
                    { hour: 15, level: '보통', levelClass: 'level-2' },
                    { hour: 16, level: '원활', levelClass: 'level-1' },
                    { hour: 17, level: '원활', levelClass: 'level-1' },
                    { hour: 18, level: '보통', levelClass: 'level-2' },
                    { hour: 19, 'level': '혼잡', levelClass: 'level-3'},
                    { hour: 20, 'level': '혼잡', levelClass: 'level-3'},
                    { hour: 21, level: '보통', levelClass: 'level-2' }
                ]
            };
            return Promise.resolve(mockApiData);
        }
        
        // For all other combinations, the API call fails to demonstrate the fallback
        return Promise.reject('API endpoint not available for the selected combination.');
    }

    /**
     * Fetches temperature data from the Open-Meteo API.
     */
    async function fetchTemperatureFromAPI(regionValue, date) {
        const REGION_COORDINATES = {
            seoul_gangnam: { latitude: 37.5172, longitude: 127.0473 },
            anyang_pyeongchon: { latitude: 37.3923, longitude: 126.9567 },
            gunpo_sanbon: { latitude: 37.3591, longitude: 126.9328 },
            uiwang: { latitude: 37.3452, longitude: 126.9685 },
            seoul_yangjae: { latitude: 37.4836, longitude: 127.0326 },
            gyeonggi_gwangmyeong: { latitude: 37.4786, longitude: 126.8654 },
        };

        const coords = REGION_COORDINATES[regionValue];
        if (!coords) {
            throw new Error(`Coordinates not found for region: ${regionValue}`);
        }

        const dateString = date.toISOString().split('T')[0];
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=temperature_2m_max,temperature_2m_min&start_date=${dateString}&end_date=${dateString}&timezone=Asia/Seoul`;

        console.log(`Fetching real temperature from: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Weather API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data.daily && data.daily.temperature_2m_min && data.daily.temperature_2m_max) {
            return {
                min_temp: data.daily.temperature_2m_min[0],
                max_temp: data.daily.temperature_2m_max[0]
            };
        } else {
            throw new Error('Invalid data format from Weather API');
        }
    }


    /**
     * Generates congestion data based on a heuristic model.
     */
    function getFallbackCongestionData(martValue, date) {
        const day = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const isWeekend = (day === 0 || day === 6);
        // Note: A real implementation would need a proper holiday calendar.
        const isHoliday = false; 

        let dayWeight = 1.0;
        if (isHoliday) dayWeight = 1.6;
        else if (isWeekend) dayWeight = 1.5;

        const isWarehouseMart = (martValue === 'costco' || martValue === 'traders');
        
        const hourly_congestion = [];
        // Operating hours from 10:00 to 23:00
        for (let hour = 10; hour < 23; hour++) {
            let timeWeight = 1.0;
            if (hour >= 10 && hour < 12) timeWeight = 0.8; // Morning
            else if (hour >= 12 && hour < 14) timeWeight = 1.0; // Lunch
            else if (hour >= 14 && hour < 18) timeWeight = 1.2; // Afternoon
            else if (hour >= 18 && hour < 21) timeWeight = 1.8; // Peak
            else if (hour >= 21) timeWeight = 1.1; // Closing

            let martWeight = 1.0;
            if (isWarehouseMart && isWeekend && hour >= 14 && hour < 18) {
                martWeight = 1.1;
            }

            const score = dayWeight * timeWeight * martWeight;
            
            let level = '원활';
            let levelClass = 'level-1';
            if (score >= 1.7) {
                level = '매우 혼잡';
                levelClass = 'level-4';
            } else if (score >= 1.4) {
                level = '혼잡';
                levelClass = 'level-3';
            } else if (score >= 1.0) {
                level = '보통';
                levelClass = 'level-2';
            }
            
            hourly_congestion.push({
                hour,
                level,
                levelClass
            });
        }

        return {
            source: '통계',
            hourly_congestion
        };
    }

    /**
     * Renders the results in the DOM.
     */
    function renderResults(congestionData, weatherData, regionText, martText, date) { // Updated signature
        const dateString = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        // Update results title
        resultsTitle.textContent = `${dateString} ${martText} 예상 혼잡도 (출처: ${congestionData.source})`;

        // Update weather info
        if (weatherData) {
            weatherInfoElement.textContent = `예상 기온: 최저 ${weatherData.min_temp}°C / 최고 ${weatherData.max_temp}°C`;
        } else {
            weatherInfoElement.textContent = '날씨 정보를 불러올 수 없습니다.';
        }


        resultsList.innerHTML = '';
        if (congestionData.hourly_congestion.length === 0) {
            resultsList.innerHTML = '<li>데이터가 없습니다.</li>';
            return;
        }

        congestionData.hourly_congestion.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="time">${item.hour}:00 - ${item.hour + 1}:00</span>
                <span class="level ${item.levelClass}">${item.level}</span>
            `;
            resultsList.appendChild(li);
        });
    }
});

