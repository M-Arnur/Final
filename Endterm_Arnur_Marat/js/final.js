$(function () {
    function updateThemeButton() {
        const dark = document.documentElement.dataset.theme === 'dark';
        $('.theme-toggle').text(dark ? 'Light theme' : 'Dark theme').attr('aria-pressed', String(dark));
    }
    updateThemeButton();
    $('.theme-toggle').on('click', function () {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('line-theme', next); }
        catch (error) {}
        updateThemeButton();
    });

    let user = null;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    try {
        const saved = JSON.parse(localStorage.getItem('line-user'));
        if (saved && typeof saved.name === 'string' && saved.name.trim() && saved.name.length <= 60 && typeof saved.email === 'string' && saved.email.length <= 120 && emailPattern.test(saved.email)) {
            user = {name:saved.name, email:saved.email};
        }
    } catch (error) {}
    function renderUser() {
        $('.sign-in-link').prop('hidden', Boolean(user));
        $('.user-greeting').prop('hidden', !user).text(user ? 'Hi, ' + user.name : '');
        $('.account-tools .sign-out').prop('hidden', !user);
        $('#sign-in').prop('hidden', Boolean(user));
        $('#profile-panel').prop('hidden', !user);
        $('#profile-title').text(user ? 'Welcome, ' + user.name + '.' : '');
    }
    renderUser();
    function validateLogin(field) {
        const value = field.value.trim();
        const error = !value ? 'This field is required.' : field.id === 'login-email' && !emailPattern.test(value) ? 'Enter a valid email address.' : !field.checkValidity() ? field.validationMessage : '';
        field.setAttribute('aria-invalid', String(Boolean(error)));
        $('#' + field.id + '-error').text(error);
        return !error;
    }
    $('#sign-in input').on('input', function () { validateLogin(this); });
    $('#sign-in').on('submit', function (event) {
        event.preventDefault();
        const inputs = Array.from(this.querySelectorAll('input'));
        if (!inputs.map(validateLogin).every(Boolean)) {
            this.querySelector('[aria-invalid="true"]').focus();
            return;
        }
        const profile = {name:$('#login-name').val().trim(), email:$('#login-email').val().trim()};
        try { localStorage.setItem('line-user', JSON.stringify(profile)); }
        catch (error) {
            $('#login-status').text('Your browser blocked storage.');
            return;
        }
        user = profile;
        renderUser();
        $('#login-status').text('Signed in.');
        if (!$('#name').val()) $('#name').val(user.name);
        if (!$('#email').val()) $('#email').val(user.email);
        $('#profile-panel .sign-out').trigger('focus');
    });
    $('.sign-out').on('click', function () {
        try { localStorage.removeItem('line-user'); }
        catch (error) {
            $('#login-status').text('Could not clear saved profile. Check browser storage permissions and retry.');
            return;
        }
        user = null;
        renderUser();
        $('#sign-in').each(function () { this.reset(); });
        $('#login-status').text('Signed out.');
        if ($('#login-name').length) $('#login-name').trigger('focus');
        else $('.sign-in-link').trigger('focus');
    });
    if (user) {
        if (!$('#name').val()) $('#name').val(user.name);
        if (!$('#email').val()) $('#email').val(user.email);
    }

    $('.faq-question').on('click', function () {
        const button = $(this);
        const opening = button.attr('aria-expanded') !== 'true';
        const answer = $('#' + button.attr('aria-controls'));
        button.attr('aria-expanded', String(opening));
        button.find('.faq-indicator').text(opening ? '−' : '+');
        if (answer.prop('hidden')) answer.prop('hidden', false).hide();
        answer.stop(true, true).slideToggle(220);
    });

    if ($('#refresh-rates').length) {
        const services = window.LINEBarber.getServices();
        let rateData = null;
        let loading = false;
        const endpoint = 'https://open.er-api.com/v6/latest/KZT';

        function formatPrice(amount, currency) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                currencyDisplay: 'code',
                minimumFractionDigits: currency === 'KZT' ? 0 : 2,
                maximumFractionDigits: currency === 'KZT' ? 0 : 2
            }).format(amount);
        }

        function renderPrices() {
            const currency = $('#price-currency').val();
            const rate = currency === 'KZT' ? 1 : rateData ? rateData.rates[currency] : null;
            $('#converted-price-heading').text('Price (' + currency + ')');
            const body = $('#currency-rows').empty();
            services.forEach(function (service) {
                const row = $('<tr>');
                $('<th scope="row">').text(service.name).appendTo(row);
                $('<td>').text(formatPrice(service.price, 'KZT')).appendTo(row);
                $('<td>').text(rate === null ? 'Unavailable' : formatPrice(service.price * rate, currency)).appendTo(row);
                row.appendTo(body);
            });
            if (!services.length) {
                body.append($('<tr>').append($('<td colspan="3">').text('No services in the menu. Add a service on the Services page.')));
            }
            if (rateData) {
                const updated = new Date(rateData.time_last_update_unix * 1000).toLocaleString();
                const details = currency === 'KZT' ? 'Base prices in KZT.' : '1 KZT = ' + rate.toFixed(6) + ' ' + currency + '.';
                $('#rate-details').text(details + ' Rate update: ' + updated + '.');
            } else {
                $('#rate-details').text(currency === 'KZT' ? 'Base prices in KZT do not require an exchange rate.' : 'Load exchange rates to see converted prices.');
            }
        }

        async function loadRates() {
            if (loading) return;
            loading = true;
            rateData = null;
            renderPrices();
            $('#refresh-rates').prop('disabled', true).text('Loading…');
            $('#currency-table-wrap').attr('aria-busy', 'true');
            $('#currency-status').text('Loading exchange rates… Base prices remain available in KZT.');
            const controller = new AbortController();
            const timeout = setTimeout(function () { controller.abort(); }, 12000);
            try {
                const response = await fetch(endpoint, {signal: controller.signal});
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                if (data.result !== 'success' || data.base_code !== 'KZT' || !data.rates || data.rates.KZT !== 1 ||
                    !['USD', 'EUR'].every(function (currency) { return Number.isFinite(data.rates[currency]) && data.rates[currency] > 0; }) ||
                    !Number.isFinite(data.time_last_update_unix) || data.time_last_update_unix <= 0 ||
                    !Number.isFinite(new Date(data.time_last_update_unix * 1000).getTime())) {
                    throw new Error('Incomplete exchange rate data');
                }
                rateData = data;
                renderPrices();
                $('#currency-status').text('Exchange rates loaded. Select a currency to compare service prices.');
            } catch (error) {
                renderPrices();
                $('#currency-status').text('Exchange rates are unavailable. Base prices in KZT still work. Check your connection and select Refresh exchange rates to retry.');
            } finally {
                clearTimeout(timeout);
                loading = false;
                $('#currency-table-wrap').attr('aria-busy', 'false');
                $('#refresh-rates').prop('disabled', false).text('Refresh exchange rates');
            }
        }

        $('#price-currency').on('change', function () {
            renderPrices();
            if ($(this).val() !== 'KZT' && !rateData && !loading) loadRates();
            else if (!loading) $('#currency-status').text($(this).val() === 'KZT' ? 'Base service prices are shown in KZT.' : 'Prices converted using the loaded exchange rates.');
        });
        $('#refresh-rates').on('click', loadRates);
        renderPrices();
    }
});
