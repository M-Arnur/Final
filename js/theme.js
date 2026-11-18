(function () {
    let theme = 'light';
    try {
        if (localStorage.getItem('line-theme') === 'dark') theme = 'dark';
    } catch (error) {}
    document.documentElement.dataset.theme = theme;
})();
