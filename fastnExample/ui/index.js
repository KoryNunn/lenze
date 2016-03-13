var fastn = require('./fastn');

module.exports = function(worker){
    var app = require('./app')(worker);

    var ui = fastn('div',
            fastn('h1', fastn.binding('heading')),
            fastn('input')
            .on('keyup', function(event, scope){
                scope.get('.').setSearch(event.target.value);
            }),
            fastn('list', {
                items: fastn.binding('visibleUsers|*'),
                template: function(){
                    return fastn('div',
                        'Name: ', fastn.binding('name'),
                        ' - ',
                        'Age: ', fastn.binding('dob', function(dob){
                            return new Date().getYear() - dob.getYear();
                        })
                    )
                    .binding('item')
                    .on('click', function(event, scope){
                        scope.get('logName')();
                    });
                }
            })
        ).attach(app);

    window.onload = function(){
        document.body.appendChild(ui.render().element);
    }
};