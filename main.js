document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('congestion-form');
    const dateInput = document.getElementById('date');
    const resultsContainer = document.getElementById('results-container');
    const resultsTitle = document.getElementById('results-title');
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
        const mart = form.mart.options[form.mart.selectedIndex];
        const martValue = mart.value;
        const martText = mart.text;
        const date = new Date(dateInput.value);

        resultsContainer.classList.remove('hidden');
        resultsList.innerHTML = '<li>데이터를 불러오는 중입니다...</li>';
        resultsTitle.textContent = '';

        try {
            // Step 1: Attempt to fetch from the primary API
            const apiData = await fetchCongestionFromAPI(regionValue, martValue, date);
            renderResults(apiData, region, martText, date); // Keep original 'region' for rendering
        } catch (error) {
            // Step 2: If API fails, use the fallback model
            console.warn('API fetch failed, using fallback model:', error);
            const fallbackData = getFallbackCongestionData(martValue, date);
            renderResults(fallbackData, region, martText, date); // Keep original 'region' for rendering
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
    function renderResults(data, region, martText, date) {
        const dateString = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        resultsTitle.textContent = `${dateString} ${martText} 예상 혼잡도 (출처: ${data.source})`;

        resultsList.innerHTML = '';
        if (data.hourly_congestion.length === 0) {
            resultsList.innerHTML = '<li>데이터가 없습니다.</li>';
            return;
        }

        data.hourly_congestion.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="time">${item.hour}:00 - ${item.hour + 1}:00</span>
                <span class="level ${item.levelClass}">${item.level}</span>
            `;
            resultsList.appendChild(li);
        });
    }
});
