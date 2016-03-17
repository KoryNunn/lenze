var fastn = require('./fastn');

module.exports = function(worker){
    var app = require('./app')(worker);

    function renderUser(){
        return fastn('div',
            'Name: ', fastn.binding('name'),
            ' - ',
            'Age: ', fastn.binding('dob', function(dob){
                return new Date().getYear() - dob.getYear();
            })
        )
        .binding('item')
    };

    var ui = fastn('div',
            fastn('h1', fastn.binding('heading')),
            fastn('div',
                fastn('input')
                .on('keyup', function(event, scope){
                    scope.get('.').setSearch(event.target.value);
                })
            ),
            fastn('templater', {
                data: fastn.binding('selectedUser'),
                template: function(model){
                    if(model.get('item')){
                        return fastn('div',
                            'SelectedUser: ',
                            fastn('input', {value: fastn.binding('name')})
                            .on('keyup', function(event, scope){
                                scope.get('.').setName(event.target.value);
                            })
                        )
                        .binding('item');
                    }
                }
            }),
            'All users:',
            fastn('list', {
                items: fastn.binding('visibleUsers|*'),
                template: function(){
                    return renderUser().on('click', function(event, scope){
                        app.setSelectedUser(scope.get('.'));
                    });
                }
            })
        ).attach(app);

    window.onload = function(){
        document.body.appendChild(ui.render().element);
    }
};