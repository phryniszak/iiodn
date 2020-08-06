module.exports = {
    // http://eslint.org/docs/rules/
    "env": {
        "node": true,
        "es6": true
    },
    "parserOptions": { "ecmaVersion": 11 },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "off",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-console": 0
    },
    "globals": {
        "ParserError": true
    }
};