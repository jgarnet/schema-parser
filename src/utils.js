function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(name) {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
    if (name.endsWith('s')) return name.slice(0, -1);
    return name;
}

module.exports = {
    capitalize,
    singularize
};